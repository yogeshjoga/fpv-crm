-- Careers: editable role templates (job descriptions per role and level) and offer letters.
-- An admin gives a candidate name, picks a role and level, and the job description and the letter are prepared.
-- Everything on a letter (dates, pay, paid / unpaid / pay-for-training, terms) is stored on the offer so it can be edited.
-- Same permission as the rest of Careers: has_module_access('careers', ...).

create table public.careers_role_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  title text not null check (char_length(title) between 3 and 160),
  department text not null default '' check (char_length(department) <= 120),
  summary text not null default '' check (char_length(summary) <= 400),
  jd text not null default '' check (char_length(jd) <= 20000),
  -- { intern, fresher, experienced }: what is different at each level, appended to the job description
  level_notes jsonb not null default '{}'::jsonb check (jsonb_typeof(level_notes) = 'object' and pg_column_size(level_notes) < 20000),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.careers_offers (
  id uuid primary key default gen_random_uuid(),
  offer_no text unique,
  application_id uuid references public.careers_applications(id) on delete set null,
  role_template_id uuid references public.careers_role_templates(id) on delete set null,
  candidate_name text not null check (char_length(candidate_name) between 2 and 160),
  candidate_email text not null default '' check (char_length(candidate_email) <= 200),
  role_title text not null check (char_length(role_title) between 3 and 160),
  level text not null default 'intern' check (level in ('intern', 'fresher', 'experienced')),
  employment_type text not null default 'internship' check (employment_type in ('internship', 'full_time', 'part_time', 'contract')),
  department text not null default '' check (char_length(department) <= 120),
  work_mode text not null default 'onsite' check (work_mode in ('onsite', 'remote', 'hybrid')),
  location text not null default '' check (char_length(location) <= 160),
  reporting_to text not null default '' check (char_length(reporting_to) <= 160),
  working_hours text not null default '' check (char_length(working_hours) <= 200),
  issued_on date not null default current_date,
  valid_until date,
  start_date date,
  end_date date,
  probation_months integer check (probation_months is null or probation_months between 0 and 24),
  notice_days integer check (notice_days is null or notice_days between 0 and 365),
  -- paid: the company pays pay_amount; unpaid: no pay; pay_to_train: the candidate pays a training fee first,
  -- then once training is completed well the company pays post_training_amount every month
  compensation_mode text not null default 'paid' check (compensation_mode in ('paid', 'unpaid', 'pay_to_train')),
  pay_amount numeric check (pay_amount is null or pay_amount >= 0),
  pay_period text not null default 'month' check (pay_period in ('month', 'year')),
  training_fee numeric check (training_fee is null or training_fee >= 0),
  training_months integer check (training_months is null or training_months between 1 and 36),
  post_training_amount numeric check (post_training_amount is null or post_training_amount >= 0),
  post_training_from date,
  compensation_note text not null default '' check (char_length(compensation_note) <= 3000),
  jd text not null default '' check (char_length(jd) <= 20000),
  terms text not null default '' check (char_length(terms) <= 20000),
  signatory_name text not null default '' check (char_length(signatory_name) <= 160),
  signatory_designation text not null default '' check (char_length(signatory_designation) <= 200),
  status text not null default 'draft' check (status in ('draft', 'issued', 'accepted', 'declined', 'withdrawn')),
  responded_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index careers_offers_app on public.careers_offers (application_id);
create index careers_offers_created on public.careers_offers (created_at desc);

create sequence public.careers_offer_seq;

create or replace function public.careers_offer_prepare()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.offer_no is null then
    new.offer_no := 'EGR-OFR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.careers_offer_seq')::text, 4, '0');
  end if;
  if tg_op = 'UPDATE' then new.offer_no := old.offer_no; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger careers_offers_prepare before insert or update on public.careers_offers
  for each row execute function public.careers_offer_prepare();

create or replace function public.careers_touch_generic()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger careers_role_templates_touch before update on public.careers_role_templates
  for each row execute function public.careers_touch_generic();

alter table public.careers_role_templates enable row level security;
alter table public.careers_offers enable row level security;

create policy careers_role_templates_read on public.careers_role_templates for select using (public.has_module_access('careers', 'read'));
create policy careers_role_templates_write on public.careers_role_templates for all
  using (public.has_module_access('careers', 'write')) with check (public.has_module_access('careers', 'write'));

create policy careers_offers_staff_read on public.careers_offers for select using (public.has_module_access('careers', 'read'));
create policy careers_offers_staff_write on public.careers_offers for all
  using (public.has_module_access('careers', 'write')) with check (public.has_module_access('careers', 'write'));
-- a candidate who applied through the portal sees their own letter once it is issued
create policy careers_offers_own_read on public.careers_offers for select using (
  status in ('issued', 'accepted', 'declined')
  and exists (select 1 from public.careers_applications a where a.id = careers_offers.application_id and a.student_id = auth.uid())
);

create or replace function public.careers_respond_offer(p_offer uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_offer public.careers_offers;
begin
  select o.* into v_offer from public.careers_offers o
   where o.id = p_offer
     and exists (select 1 from public.careers_applications a where a.id = o.application_id and a.student_id = auth.uid())
   for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_offer.status <> 'issued' then raise exception 'This offer can no longer be answered'; end if;
  if v_offer.valid_until is not null and v_offer.valid_until < current_date then raise exception 'This offer has expired'; end if;
  update public.careers_offers
     set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
   where id = p_offer;
  insert into public.careers_events (application_id, actor, kind, note, visible_to_student)
  values (v_offer.application_id, auth.uid(), case when p_accept then 'offer_accepted' else 'offer_declined' end,
          case when p_accept then 'Offer accepted' else 'Offer declined' end, true);
end $$;
revoke all on function public.careers_respond_offer(uuid, boolean) from public, anon;
grant execute on function public.careers_respond_offer(uuid, boolean) to authenticated;

-- Starting job descriptions for the roles we hire for. Admins edit them under Careers → Role templates.
insert into public.careers_role_templates (slug, title, department, summary, sort_order, jd, level_notes) values
('pcb-designer', 'PCB Designer', 'Hardware', 'Design flight controllers, ESCs and power boards for our FPV and drone products.', 1,
$jd$About the role
You will design and release PCBs for EgireRobotics drones and training kits, from schematic to a board that is ready to be fabricated and assembled.

What you will do
- Draw schematics and lay out multi-layer PCBs for flight controllers, ESCs, PDBs and sensor boards
- Choose components, check footprints and keep the bill of materials up to date
- Follow high-current, high-speed and EMI-aware layout practice
- Prepare Gerber, drill, BOM and pick-and-place files for fabrication
- Support bring-up and debugging of the boards you design

What we look for
- Hands-on with KiCad, Altium or Eagle
- Good understanding of power electronics, MCUs (STM32 or similar) and common buses (SPI, I2C, UART, CAN)
- Care about clean layouts, documentation and design reviews$jd$,
'{"intern":"You will work on a board with a mentor, starting with small modules and moving to a complete design. We care more about how you learn than what you already know.","fresher":"You will own small and medium boards with design reviews from a senior engineer. 0 to 1 year of project or work experience is fine.","experienced":"You will own complete product boards end to end, review other designs and help set our PCB standards. 2 or more years of PCB design in production is expected."}'::jsonb),

('fpv-pilot', 'FPV Pilot', 'Flight operations', 'Fly, test and teach FPV drones for training batches, demos and product testing.', 2,
$jd$About the role
You will fly FPV drones for our training programmes, product testing and demonstrations, and help students become safe, confident pilots.

What you will do
- Fly freestyle, racing and cinematic FPV drones in the field and in simulators
- Test builds and tuning (PID, rates, filters) and report what you find
- Run pre-flight and post-flight checks and keep flight and maintenance logs
- Help instructors with practical sessions and coach students
- Follow DGCA rules and our safety procedures at every flight

What we look for
- Real flying hours on FPV quads and comfort with Betaflight tuning
- Ability to build and repair a quad (soldering, motors, ESCs, radios)
- Calm, safety-first attitude$jd$,
'{"intern":"You will assist on sessions, fly in the simulator and on the field under supervision, and log flights. A drone course with us or similar flying experience helps.","fresher":"You will fly and test independently on approved sessions and support student batches. Some logged flying hours are expected.","experienced":"You will lead test flights and practical sessions, mentor pilots and help set our flying and safety standards. Strong hours, tuning skill and instructing experience are expected."}'::jsonb),

('pcb-rework-engineer', 'PCB Rework Engineer', 'Hardware', 'Repair, rework and test boards: BGA, QFN and fine-pitch components.', 3,
$jd$About the role
You will repair and rework flight controllers, ESCs and other boards, and find why a board failed before it goes back into a drone.

What you will do
- Diagnose faulty boards with a multimeter, oscilloscope and thermal camera
- Replace SMD parts, including QFN, BGA and fine-pitch ICs, using hot air and a rework station
- Fix lifted pads, broken traces and damaged connectors
- Re-test repaired boards and record the root cause of each failure
- Keep the rework bench, tools and ESD practice in good order

What we look for
- Steady hands and proven soldering and desoldering skill
- Basic electronics: power rails, MOSFET and driver circuits, MCU boot checks
- Patient, methodical approach to fault finding$jd$,
'{"intern":"You will practise on spare and scrap boards first, then do supervised repairs.","fresher":"You will handle standard repairs on your own and move to fine-pitch and BGA work with guidance.","experienced":"You will handle the hardest repairs, find root causes, improve our rework process and train others."}'::jsonb),

('ai-ml-developer', 'AI / ML Developer', 'AI and software', 'Build and ship machine-learning features for our products and training platform.', 4,
$jd$About the role
You will build, train and deploy machine-learning models and the services around them, from data preparation to a feature that students and customers use.

What you will do
- Prepare datasets, train and evaluate models, and track experiments
- Turn models into APIs or edge builds that run reliably
- Work with PyTorch or TensorFlow and the Python data stack
- Write clean, tested code and document what you build
- Work with the web and embedded teams to put models into products

What we look for
- Strong Python and solid machine-learning fundamentals
- Experience with at least one real project, notebook or deployed model
- Comfort with Git, Linux and reading research papers$jd$,
'{"intern":"You will work on a defined task such as data cleaning, a baseline model or an evaluation script, with a mentor.","fresher":"You will build and evaluate models for real features with review from a senior developer. Projects and internships count as experience.","experienced":"You will own models and pipelines in production, make design choices and mentor junior developers. 2 or more years of applied ML work is expected."}'::jsonb),

('ai-architect', 'AI Architect', 'AI and software', 'Design the AI systems behind our products: data, models, serving and cost.', 5,
$jd$About the role
You will decide how our AI systems are built: which models, how data flows, how they are served, and how we keep them accurate, safe and affordable.

What you will do
- Design end-to-end AI architectures across cloud and edge devices
- Choose models, frameworks, vector stores and serving approaches
- Set standards for data quality, evaluation, monitoring and security
- Review designs and code from the AI team and unblock them
- Plan capacity, latency and cost, and explain trade-offs to the leadership

What we look for
- Deep experience shipping ML systems to production
- Strong grounding in LLMs, computer vision and MLOps
- Clear communication of complex designs$jd$,
'{"intern":"You will support the architect by researching options, building small proofs of concept and writing design notes.","fresher":"You will contribute to designs and build proofs of concept under the architect. Strong projects and research can stand in for work experience.","experienced":"You will lead the architecture of our AI platform and own its technical decisions. 5 or more years including production AI systems is expected."}'::jsonb),

('computer-vision-yolo-researcher', 'Computer Vision and YOLO Researcher', 'AI and research', 'Research and build detection and tracking models (YOLO and beyond) for drones.', 6,
$jd$About the role
You will research and build computer-vision models that run on drones and edge devices: object detection, tracking and scene understanding.

What you will do
- Collect, label and curate image and video datasets
- Train, tune and compare YOLO and other detection and tracking models
- Optimise models for edge hardware (TensorRT, ONNX, quantisation)
- Run experiments, report results honestly and write them up
- Work with the flight and embedded teams to test models on real drones

What we look for
- Good Python, PyTorch and OpenCV skills
- Hands-on training of YOLO or similar detectors
- Curiosity, careful experiment habits and clear reports$jd$,
'{"intern":"You will label data, run training experiments and report results with a mentor.","fresher":"You will train and optimise models for specific tasks and present findings. Strong projects or publications count.","experienced":"You will lead research directions, own model performance on real flights and mentor the team. 2 or more years in computer vision is expected."}'::jsonb),

('blender-3d-designer', 'Blender 3D Model Designer', 'Design', 'Model drones, parts and scenes in Blender for products, training and marketing.', 7,
$jd$About the role
You will create 3D models, renders and animations of our drones, parts and training scenes.

What you will do
- Model clean, accurate hard-surface drone and component models in Blender
- Texture, light and render product images and short animations
- Prepare models for real-time and web use and for 3D printing where needed
- Build simple scenes for tutorials, simulators and marketing
- Keep a tidy library of assets and file versions

What we look for
- Strong Blender skills and a portfolio you can show
- Good sense of form, scale and detail
- Ability to work from drawings and real parts$jd$,
'{"intern":"You will model parts and simple scenes from references, with feedback on your work.","fresher":"You will deliver complete models and renders on your own with review. A good portfolio matters most.","experienced":"You will lead 3D work across products and marketing, set quality standards and guide other designers."}'::jsonb),

('full-stack-web-developer', 'Full Stack Web Developer', 'Software', 'Build and run our web apps: LMS, CRM and customer sites.', 8,
$jd$About the role
You will build features across our web platform, from the database to the screen, and keep it fast, secure and easy to use.

What you will do
- Build React and TypeScript front-ends and the APIs behind them
- Design Postgres schemas, queries and row-level security rules
- Write clear, tested code and review others' work
- Deploy and monitor the app and fix problems quickly
- Work with admins and students to turn needs into simple features

What we look for
- Solid JavaScript or TypeScript, React and a SQL database
- Understanding of authentication, security and REST or serverless APIs
- Care for usability and for details$jd$,
'{"intern":"You will build small features and fix bugs with a mentor and learn our stack.","fresher":"You will build complete features with code review. Projects and internships count as experience.","experienced":"You will own major parts of the platform, make design decisions and mentor others. 2 or more years of full stack work is expected."}'::jsonb),

('full-stack-embedded-engineer', 'Full Stack Embedded Engineer', 'Embedded', 'Firmware, hardware interfaces and the software that talks to them.', 9,
$jd$About the role
You will work across the whole embedded stack: firmware on microcontrollers, interfaces to sensors and radios, and the companion software that configures and monitors the hardware.

What you will do
- Write and debug firmware in C or C++ for STM32, ESP32 or similar
- Bring up new boards and drivers (SPI, I2C, UART, CAN, PWM, DShot)
- Work on flight-control, telemetry and radio-link software
- Build tools and apps that configure, log and visualise device data
- Test on the bench and on real drones, and document what you find

What we look for
- Strong C and C++ and understanding of RTOS and interrupts
- Comfort with schematics, oscilloscopes and logic analysers
- Some Python, web or app skills for tooling$jd$,
'{"intern":"You will write and test small firmware and tool pieces on dev boards with a mentor.","fresher":"You will deliver drivers and features with review. Strong projects and internships count.","experienced":"You will own firmware modules and architecture, review code and mentor others. 2 or more years in embedded work is expected."}'::jsonb);
