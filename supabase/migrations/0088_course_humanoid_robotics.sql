-- Course: Humanoid Robotics, from zero to AI-based robots.
-- Twelve modules (one article each, in the same plain-text style as the other courses), a 49-question exam bank,
-- and a cover image. It is added as a DRAFT so an admin can read it and press Publish. Safe to re-run: it does
-- nothing if the course already exists.

create or replace function pg_temp.addq(p_course uuid, p_owner uuid, p_diff text, p_type text, p_correct int[], p_block text)
returns void language plpgsql as $$
declare
  lines text[] := string_to_array(p_block, E'\n');
  n int := array_length(lines, 1);
  v_q uuid;
  i int;
begin
  insert into public.questions (course_id, prompt, type, explanation, is_active, created_by, difficulty, points)
  values (p_course, lines[1], p_type::public.question_type, lines[n], true, p_owner, p_diff, 1)
  returning id into v_q;
  for i in 2 .. n - 1 loop
    insert into public.question_options (question_id, label, is_correct, position)
    values (v_q, lines[i], (i - 1) = any (p_correct), i - 2);
  end loop;
end $$;

do $course$
declare
  v_owner uuid;
  v_course uuid;
  v_mod uuid;
  v_cover text;
begin
  if exists (select 1 from public.courses where slug = 'humanoid-robotics' or course_code = 'HUMANOID') then
    raise notice 'Humanoid Robotics course already exists; nothing to do';
    return;
  end if;
  select id into v_owner from public.profiles where role = 'super_admin' order by created_at limit 1;

  v_cover := 'data:image/svg+xml;base64,' || replace(encode(convert_to($svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" font-family="Arial, sans-serif">
<defs><linearGradient id="bg" x1="0" y1="0" x2="800" y2="450" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0f172a"/><stop offset="1" stop-color="#4338ca"/></linearGradient></defs>
<rect width="800" height="450" fill="url(#bg)"/>
<circle cx="110" cy="80" r="3" fill="#fff" opacity=".5"/><circle cx="700" cy="70" r="2" fill="#fff" opacity=".4"/><circle cx="740" cy="380" r="2.5" fill="#fff" opacity=".4"/><circle cx="70" cy="370" r="2" fill="#fff" opacity=".4"/>
<g transform="translate(400,255)" fill="#f8fafc">
<rect x="-26" y="-118" width="52" height="46" rx="14"/>
<rect x="-14" y="-72" width="28" height="12" rx="4" fill="#94a3b8"/>
<rect x="-52" y="-60" width="104" height="92" rx="16"/>
<rect x="-34" y="-40" width="68" height="34" rx="8" fill="#22d3ee"/>
<rect x="-84" y="-56" width="26" height="86" rx="12"/><rect x="58" y="-56" width="26" height="86" rx="12"/>
<rect x="-44" y="36" width="30" height="92" rx="12"/><rect x="14" y="36" width="30" height="92" rx="12"/>
<rect x="-52" y="126" width="46" height="14" rx="6" fill="#94a3b8"/><rect x="6" y="126" width="46" height="14" rx="6" fill="#94a3b8"/>
<circle cx="-10" cy="-98" r="5" fill="#22d3ee"/><circle cx="10" cy="-98" r="5" fill="#22d3ee"/>
</g>
<path d="M120 230 H250" stroke="#fff" stroke-width="3" opacity=".3" stroke-linecap="round"/><path d="M550 300 H690" stroke="#fff" stroke-width="3" opacity=".25" stroke-linecap="round"/>
<text x="400" y="62" font-size="32" fill="#fff" text-anchor="middle" font-weight="bold">Humanoid Robotics</text>
<text x="400" y="94" font-size="15" fill="#c7d2fe" text-anchor="middle">From zero to building AI-based robots</text>
</svg>$svg$, 'utf8'), 'base64'), E'\n', '');

  insert into public.courses (title, slug, course_code, summary, description, status, pass_pct, exam_time_limit_min, exam_question_count,
                              max_attempts, cooldown_hours, created_by, cert_type, cover_image_url, grading_mode, scoring_mode, certificate_mode)
  values (
    'Humanoid Robotics: Zero to AI Robots',
    'humanoid-robotics',
    'HUMANOID',
    'Start with no robotics background and finish by building, programming and demonstrating a small AI-powered humanoid robot.',
    $d$Course info
* Duration: 12 Modules
* Level: Absolute Beginner to Advanced
* Total hours: 40h
* Highlight: AI Robots

-- No robotics background needed --
You do not need to have built a robot, written a control loop or trained a neural network. The course follows the order you would really work in: understand what a humanoid is, learn the maths and electronics you need, design the body, program it, make it balance and walk, give it eyes, then give it AI. The final exam draws 25 random questions from a bank of 49 covering every module, and the last module is a capstone where you build and demonstrate a small humanoid of your own.

-- What you will be able to do --
* Explain how a humanoid robot senses, thinks and acts
* Choose motors, batteries and sensors and wire them safely
* Work out joint angles with kinematics and keep a robot balanced with feedback control
* Use a camera and object detection so the robot can see
* Use machine learning and language models as the thinking layer without giving up safety
* Plan, build, test and demonstrate a small humanoid with a proper safety review$d$,
    'draft', 70, 30, 25, 3, 24, v_owner, 'Participation', v_cover, 'pass_fail', 'exam_only', 'manual'
  ) returning id into v_course;

  /* ───────────────────────── Module 1 ───────────────────────── */
  insert into public.modules (course_id, title, position) values (v_course, 'Module 1: What Is a Humanoid Robot?', 0) returning id into v_mod;
  insert into public.lessons (module_id, title, position, kind, content) values (v_mod, 'What Is a Humanoid Robot?', 0, 'article', $t$Duration: 2h

-- Why this matters --
Before you build anything, you need a clear picture of what a humanoid robot really is, what "AI-based" does and does not mean, and where the field honestly stands today. Get this right and the rest of the course makes sense.

-- Body plus brain --
A humanoid robot is a robot shaped roughly like a person: a torso, two arms, two legs and a head. The shape is useful because the world is built for people: doors, stairs, tools, shelves and vehicles. But the shape also makes the job hard. Walking on two legs is a balancing problem that never stops.

What makes a robot "AI-based" is its brain, not its body. The body is motors, metal or plastic, batteries and sensors. The brain is software that uses AI to understand the world (seeing, hearing), decide what to do, and sometimes to learn from experience.

-- The sense, think, act loop --
Every robot, from a toy to the most advanced humanoid, runs the same loop again and again:
* Sense: read cameras, microphones, joint encoders, an IMU (motion sensor) and force sensors
* Think: work out where things are, what the goal is and what to do next
* Act: send commands to motors, then sense again to see what happened

A balancing humanoid runs the fastest part of this loop hundreds of times per second. The slow, clever part (recognising a cup, understanding a spoken request) runs a few times per second.

-- Where humanoids are used --
* Research: universities and companies study walking, balance and manipulation
* Entertainment and education: small humanoids, kits and demonstrations
* Industry pilots: companies are testing humanoids for moving boxes and simple repetitive tasks
* Honest note: reliable, safe, affordable general-purpose humanoids are still being developed. Many impressive videos are edited, remote-controlled or very carefully staged. A good engineer learns to ask "what was automatic here?"

-- What you will build --
By the capstone you will build a small humanoid (a hobby-scale body with servo motors, a computer and a camera) and give it a few real skills: stand, balance, wave, look at a person and respond to a simple spoken request.

! Safety first -- A small humanoid can pinch fingers, a battery can start a fire, and a falling robot can break itself. Throughout this course you will use current limits, fuses, an emergency stop and a safe test area. Treat these as part of the design, not an extra.

What you will learn in this module
* The difference between the body and the brain of a robot
* The sense, think, act loop and why speed matters
* What AI adds and what it does not
* How to read robot news and demos critically$t$);

  /* ───────────────────────── Module 2 ───────────────────────── */
  insert into public.modules (course_id, title, position) values (v_course, 'Module 2: Maths and Physics, Without Fear', 1) returning id into v_mod;
  insert into public.lessons (module_id, title, position, kind, content) values (v_mod, 'Maths and Physics, Without Fear', 0, 'article', $t$Duration: 4h

-- Why this matters --
Robots are applied maths. You do not need to be a mathematician, but you must be comfortable with a few ideas: units, angles, vectors, coordinate frames, force and torque. Each one shows up in later modules, so take your time here.

-- Units, always --
Write the unit next to every number. Mixing millimetres with metres, or degrees with radians, is the most common source of bugs and broken robots.
* Length: metres (m) or millimetres (mm)
* Mass: kilograms (kg)
* Time: seconds (s)
* Angle: degrees in your head, radians in most code. 180 degrees = 3.14159 radians (pi)

-- Vectors and frames --
A vector is a number with a direction, such as a position (x, y, z) or a velocity. A coordinate frame is a point of view: the world frame, the robot body frame, the hand frame and the camera frame are all different. A cup that is 30 cm in front of the camera is somewhere else relative to the robot's hand. A big part of robotics is converting a point from one frame to another using rotations and offsets.

-- Angles and rotation --
A joint rotates by an angle. If a knee bends 40 degrees, the shin has turned 40 degrees relative to the thigh. Sine and cosine turn an angle and a length into a horizontal and a vertical distance: x = L x cos(angle), y = L x sin(angle). You will use exactly this in the kinematics module.

-- Force, torque and power --
* Force (newtons, N): a push or pull. A 1 kg mass pulls down with about 9.8 N
* Torque (newton-metres, N.m): a twisting force. Torque = force x distance from the joint. A 0.5 kg hand held 0.3 m from the shoulder needs about 0.5 x 9.8 x 0.3 = 1.5 N.m just to hold still
* Power (watts, W): how fast energy is used. Electrical power = voltage x current

-- Gears trade speed for torque --
A gearbox with a 10:1 ratio gives about 10 times the torque and 10 times less speed (minus some losses). Small hobby servos get their strength from gears, which is also why they are noisy and have some backlash (slack).

-- Centre of mass --
The centre of mass is the point where a body balances. A humanoid stays up only while the ground projection of its centre of mass stays over its feet. Keep this idea in mind for balance and walking.

! Habit to build -- Do the arithmetic on paper before buying motors. A servo rated for 2 N.m cannot hold a 3 N.m load, however nicely it is advertised.

What you will learn in this module
* Always carry units and convert angles correctly
* Think in coordinate frames
* Estimate the torque a joint needs
* Explain why centre of mass matters$t$);

  /* ───────────────────────── Module 3 ───────────────────────── */
  insert into public.modules (course_id, title, position) values (v_course, 'Module 3: Electronics and Power', 2) returning id into v_mod;
  insert into public.lessons (module_id, title, position, kind, content) values (v_mod, 'Electronics and Power', 0, 'article', $t$Duration: 4h

-- Why this matters --
Most beginner robot failures are power problems: a battery that cannot supply enough current, a loose wire, a computer that resets when the motors start. Learn the basics and you will save weeks of confusion.

-- The three electrical ideas --
* Voltage (volts, V): the electrical pressure
* Current (amps, A): how much charge flows
* Resistance (ohms): how hard it is for current to flow
Ohm's law: V = I x R. Power: P = V x I. A motor drawing 2 A from a 7.4 V battery uses about 15 W.

-- Batteries --
Most small robots use lithium polymer (LiPo) or lithium-ion cells. One cell is about 3.7 V nominal and about 4.2 V full. A "2S" pack has two cells in series, about 7.4 V.
* Capacity (mAh) tells you how long it lasts; the C rating tells you how much current it can deliver
* Never over-discharge (stay above about 3.3 V per cell), never short the pack, never charge unattended
* Use a proper balance charger and a fireproof charging bag

! Fire risk -- A damaged or short-circuited LiPo can catch fire. Put a fuse near the battery, check wires for rubbing, and store packs in a safe container.

-- Power budget --
List every part and its worst-case current. A humanoid with 17 servos can ask for many amps when all joints move or stall. Add the numbers, add a margin of at least 30 percent, and choose a battery and a regulator that can supply it. Power the computer from a separate regulator so it does not reset when the servos pull hard.

-- Brains of the robot --
* Microcontroller (Arduino, ESP32, STM32): runs tight, predictable loops; ideal for motor control and balance
* Single-board computer (Raspberry Pi, NVIDIA Jetson): runs Linux, cameras and AI; not as predictable in timing
Many humanoids use both: a microcontroller for the fast loop and a computer for vision and AI.

-- Sensors --
* IMU: gyroscope plus accelerometer (plus sometimes a magnetometer); tells the robot how it is tilting and moving
* Encoders: measure joint angles
* Force or pressure sensors in the feet: show where the weight is
* Cameras, microphones, distance sensors

-- Actuators --
* Hobby servos: cheap, easy, limited feedback
* Smart serial bus servos: report position, load and temperature; good for small humanoids
* Brushless (BLDC) motors with a controller: powerful and smooth, used in large humanoids; need more electronics knowledge

-- Wiring habits --
Short, thick power wires; connectors that cannot be plugged in backwards; strain relief at joints so wires do not fatigue; a physical emergency stop switch that cuts motor power.

What you will learn in this module
* Voltage, current and power with simple calculations
* LiPo safety rules
* How to write a power budget
* How to choose between a microcontroller and a computer$t$);

  /* ───────────────────────── Module 4 ───────────────────────── */
  insert into public.modules (course_id, title, position) values (v_course, 'Module 4: The Body: Mechanics and Actuators', 3) returning id into v_mod;
  insert into public.lessons (module_id, title, position, kind, content) values (v_mod, 'The Body: Mechanics and Actuators', 0, 'article', $t$Duration: 4h

-- Why this matters --
A beautiful program cannot rescue a weak or badly balanced body. The mechanical design decides what the robot can ever do, so spend time on it before you print or cut anything.

-- Degrees of freedom --
A degree of freedom (DoF) is one independent way a joint can move. A human leg has about six main DoF: three at the hip (forward-back, sideways, twist), one at the knee and two at the ankle. A simple educational biped may use only five or six DoF per leg in total, and a small humanoid kit often has 17 to 25 servos in all.
More DoF means more flexibility but also more weight, more power, more wiring and more things to tune. Start with fewer.

-- Links, joints and actuators --
The rigid parts are links; the moving connections are joints; the motors that move them are actuators. Place the heavy parts (battery, computer) low and close to the centre of the body. A heavy head on a thin neck, or a battery high up, makes balance much harder.

-- Choosing an actuator --
1. Work out the worst-case torque at each joint (Module 2). Knees and hips carry the most.
2. Choose a motor with at least twice that torque as a margin.
3. Check speed, weight, price and whether it reports position and temperature.
4. Check that the gear material suits the loads. Plastic gears strip under shock; metal gears survive better but cost more and are heavier.

-- Gearboxes and backlash --
Gears give torque but add backlash (a small amount of slack) and friction. High-end humanoids often use quasi-direct drive or series elastic actuators, which are springy and gentle, to cope with impacts and to sense force. For your first robot, a good serial servo is the sensible choice.

-- Materials and making --
* 3D printing (PLA, PETG, nylon): fast and cheap for brackets and shells; design with thick walls and print orientation in mind
* Aluminium sheet or machined parts: stiffer and stronger where it matters
* Fasteners: use locking nuts or thread-locker on joints that vibrate

-- Feet and balance --
Feet are bigger than they look: a larger flat foot makes standing easier. Add a rubber or foam sole for grip. Test on a smooth, level surface first.

-- CAD and iteration --
Draw the robot in CAD software first. Check that joints can reach their limits without hitting other parts, and leave space for cables. Build a small prototype of one leg before the full body. Expect to reprint parts.

! Safety -- Servo horns and gears can pinch. Keep fingers clear of joints when power is on, and never reach in while the robot is moving.

What you will learn in this module
* Degrees of freedom and why fewer is easier
* How to choose actuators with a safe torque margin
* Where to put heavy parts
* Practical building habits$t$);

  /* ───────────────────────── Module 5 ───────────────────────── */
  insert into public.modules (course_id, title, position) values (v_course, 'Module 5: Programming and Robot Software', 4) returning id into v_mod;
  insert into public.lessons (module_id, title, position, kind, content) values (v_mod, 'Programming and Robot Software', 0, 'article', $t$Duration: 4h

-- Why this matters --
A robot is software with a body attached. This module gives you the programming habits that make robot code reliable: Python, Linux, version control, timing and a gentle introduction to ROS 2, the most widely used robot software framework.

-- Linux and the terminal --
Most robot computers run Linux. Learn to move around folders, run programs, read logs and connect to the robot over SSH from your laptop. Practise on a Raspberry Pi or a Linux install; you do not need anything expensive.

-- Python first --
Python is the main language for robot logic, AI and quick experiments. The things to be comfortable with:
* Variables, lists, dictionaries, functions and classes
* Reading and writing files, handling errors
* Using libraries such as NumPy (maths), OpenCV (images) and a serial library to talk to motor controllers
Fast, safety-critical loops are often written in C or C++ on the microcontroller; Python sits on top.

-- Git --
Keep your code in Git from day one. Commit small changes with clear messages. When the robot breaks after a change, you can go back.

-- The control loop and timing --
A control loop runs at a fixed rate, for example 100 times per second (every 10 ms). The program reads sensors, calculates, and writes motor commands, then waits for the next tick.
* Jitter (uneven timing) harms balance. Measure it
* Do slow work (camera processing, speech) in a separate process so it never delays the fast loop
* Always include a watchdog: if commands stop arriving, the robot goes limp or holds safely

-- ROS 2 in plain words --
ROS 2 is a set of tools that lets separate programs talk to each other.
* Node: a small program with one job (camera, planner, motor driver)
* Topic: a named channel that nodes publish messages to and subscribe from
* Service and action: request and answer, or a long task with progress
* Launch file: starts many nodes together
You do not need ROS 2 for a tiny robot, but understanding it prepares you for real projects and open-source robot code.

-- Simulate before you run --
Test in a physics simulator (such as PyBullet or MuJoCo) before power touches the real robot. A bug in simulation costs nothing; a bug on hardware can snap a servo.

! Safety habit -- Put limits in software for every joint (minimum and maximum angle, maximum speed, maximum current) and test them with the robot hanging on a stand.

What you will learn in this module
* The software toolbox: Linux, Python, Git
* How a fixed-rate control loop works and why timing matters
* The basic ideas of ROS 2
* Why you simulate first$t$);

  /* ───────────────────────── Module 6 ───────────────────────── */
  insert into public.modules (course_id, title, position) values (v_course, 'Module 6: Kinematics: Where Is My Hand?', 5) returning id into v_mod;
  insert into public.lessons (module_id, title, position, kind, content) values (v_mod, 'Kinematics: Where Is My Hand?', 0, 'article', $t$Duration: 4h

-- Why this matters --
To make a hand reach a cup or a foot step on a spot, you must turn a target position into joint angles. That is kinematics, and it is the bridge between "what I want" and "what the motors do".

-- Forward kinematics --
Forward kinematics (FK) answers: given the joint angles, where is the hand or foot? For a flat arm with two links of lengths L1 and L2 and joint angles a1 and a2:
* x = L1 x cos(a1) + L2 x cos(a1 + a2)
* y = L1 x sin(a1) + L2 x sin(a1 + a2)
Example: L1 = L2 = 0.1 m, a1 = 90 degrees, a2 = 0 gives x = 0, y = 0.2 m. The arm points straight up.

-- Inverse kinematics --
Inverse kinematics (IK) answers the harder question: given where I want the hand, what angles do I need?
For the same two-link arm, with distance d = square root of (x squared + y squared):
* cos(a2) = (d squared - L1 squared - L2 squared) / (2 x L1 x L2)
* If d is larger than L1 + L2, the target is out of reach
* There are usually two solutions (elbow up and elbow down). Pick the one that fits your joint limits

-- Workspace and limits --
The workspace is the set of points the hand can reach. Real joints also have limits, and links can collide. Always check the answer against limits before sending it to the motors.

-- Singularities --
At a singularity (for example a fully straight arm) a small hand movement may need a huge joint movement. Good code slows down near these positions or avoids them.

-- The Jacobian, in one paragraph --
The Jacobian is a table that says how a small change in each joint angle changes the hand position. It lets you move a hand smoothly along a line by adjusting all joints together, and it also relates joint torques to forces at the hand.

-- Legs are arms too --
A leg is like an arm that points down. Given where you want the foot relative to the hip, IK gives the hip, knee and ankle angles. Walking is largely a matter of moving the feet along planned paths and using IK to find the joint angles at each moment.

! Test on the stand -- Run IK on a robot hanging from a stand first. A sign error in an angle can drive a joint into its stop at full speed.

What you will learn in this module
* Forward and inverse kinematics for a two-link arm
* Workspace, joint limits and singularities
* What the Jacobian is for
* How legs use the same ideas$t$);

  /* ───────────────────────── Module 7 ───────────────────────── */
  insert into public.modules (course_id, title, position) values (v_course, 'Module 7: Balance and Walking', 6) returning id into v_mod;
  insert into public.lessons (module_id, title, position, kind, content) values (v_mod, 'Balance and Walking', 0, 'article', $t$Duration: 5h

-- Why this matters --
Standing and walking on two legs is what makes a humanoid special and what makes it hard. A two-legged robot is unstable by nature: stop controlling it and it falls.

-- Static and dynamic stability --
* Static stability: the robot stays up even if it stops, because its centre of mass projects inside the support polygon (the area under and between the feet)
* Dynamic stability: the robot is only upright because it keeps moving and correcting, like a person walking
A beginner robot should first be statically stable: wide feet, low centre of mass and slow movement.

-- The support polygon and the ZMP --
Imagine dropping a plumb line from the centre of mass. If it lands inside the area covered by the feet, the robot is stable. The zero moment point (ZMP) is the point on the ground where the pushing forces balance out. If the ZMP stays inside the support polygon, the feet stay flat and the robot does not tip. Many walking methods plan motion so the ZMP stays safely inside.

-- The inverted pendulum --
A simple model treats the robot as a mass on top of a stick that pivots on the ground. It falls like a pendulum standing upside down, with a rate that depends on height: omega = square root of (g / h). A taller robot falls more slowly, which is one reason taller robots can be easier to balance. This linear inverted pendulum model is the basis of many walking controllers.

-- Walking in phases --
A step has a single support phase (one foot on the ground, the other swinging) and a double support phase (both feet down). A basic gait shifts weight to one foot, lifts the other, swings it forward, places it, and shifts weight again. Slow gaits with long double support are easiest.

-- Knowing which way you tilt --
An IMU contains a gyroscope (fast, but drifts over time) and an accelerometer (steady, but noisy and disturbed by movement). A complementary filter blends them:
* angle = 0.98 x (angle + gyro_rate x dt) + 0.02 x accel_angle
It is simple and surprisingly effective for balance.

-- Balance feedback --
A common first controller reads the tilt angle and nudges the ankle or hip to push the body back upright, using the PID ideas from the next module. Adding force sensors in the feet tells the robot where its weight really is.

-- Falling safely --
Every humanoid falls. Plan for it: test with a safety harness or a hanging stand, detect a fall (tilt beyond a limit), then relax the motors or tuck the arms to protect parts.

! Safety -- Keep people at a distance during walking tests. Use a harness, soft surfaces and a hand-held emergency stop.

What you will learn in this module
* Static and dynamic stability, the support polygon and the ZMP
* The inverted pendulum model
* How to estimate tilt with a complementary filter
* How to test balance safely$t$);

  /* ───────────────────────── Module 8 ───────────────────────── */
  insert into public.modules (course_id, title, position) values (v_course, 'Module 8: Control: Smooth and Safe Motion', 7) returning id into v_mod;
  insert into public.lessons (module_id, title, position, kind, content) values (v_mod, 'Control: Smooth and Safe Motion', 0, 'article', $t$Duration: 4h

-- Why this matters --
Control is how a robot turns a goal ("keep upright", "move the hand there") into steady, safe motor commands. Without good control even a perfect body shakes, overshoots or falls.

-- Feedback --
Open-loop control sends a command and hopes. Closed-loop control measures the result, compares it with the goal, and corrects. The difference between goal and measurement is the error. Nearly all robot control is feedback on an error.

-- PID in plain words --
A PID controller adds three parts to compute its correction:
* P (proportional): push in proportion to the error now. Larger P reacts faster but can oscillate
* I (integral): add up past error to remove a steady offset. Too much I causes slow wobble and windup
* D (derivative): react to how fast the error is changing, to calm overshoot. Too much D amplifies sensor noise
Tune one gain at a time: raise P until it reacts quickly and just starts to oscillate, back off, add D to damp it, and add a little I only if a steady error remains.

-- Practical limits --
* Saturation: motors have a maximum output. Clamp the command and stop the integral from growing while saturated (anti-windup)
* Filtering: smooth noisy sensor readings, but remember filtering adds delay
* Rate: a faster, steadier loop is easier to control

-- Position, velocity and torque control --
A servo usually does position control: you give an angle. Velocity control gives a speed. Torque control gives a force. Torque control is gentler and more natural for walking and for touching things, but needs good motors and drivers.

-- Smooth trajectories --
Do not jump from one angle to another. Move along a smooth path (for example a gentle ramp or a minimum-jerk curve) so accelerations stay small. Smooth motion is quieter, easier on gears and safer.

-- Compliance --
A compliant joint gives a little when pushed, which absorbs shocks and is safer near people. It can come from springs, from software (impedance control) or from limiting motor current.

-- Beyond PID --
Advanced humanoids use model predictive control (MPC), which plans a short stretch of future motion by predicting the robot's behaviour, and whole-body control, which coordinates all joints together. You will meet these in later study; PID with good limits is enough for your capstone.

-- Safety layer --
Add limits that no program above them can override: maximum joint speed, maximum current, temperature cut-off, a watchdog timer and a hardware emergency stop.

! Rule -- The safety layer must keep working even if the AI or the high-level program crashes.

What you will learn in this module
* Feedback and the three parts of PID
* How to tune a controller step by step
* Saturation, filtering, anti-windup and smooth trajectories
* Why a hard safety layer matters$t$);

  /* ───────────────────────── Module 9 ───────────────────────── */
  insert into public.modules (course_id, title, position) values (v_course, 'Module 9: Perception: Seeing and Sensing', 8) returning id into v_mod;
  insert into public.lessons (module_id, title, position, kind, content) values (v_mod, 'Perception: Seeing and Sensing', 0, 'article', $t$Duration: 4h

-- Why this matters --
A robot that cannot see or sense its surroundings can only replay motions. Perception is how it finds a person, a cup or a door, and how it knows where it is.

-- Cameras --
* RGB camera: ordinary colour images
* Depth camera: gives the distance to each pixel. Common types are stereo (two cameras), time of flight, and structured light
* Camera settings matter: exposure, focus and frame rate. Motion blur and bad lighting ruin detection more often than a weak algorithm does

-- Calibration --
A camera has internal properties (focal length, lens distortion) and a position on the robot. Calibration measures these, so that a pixel in the image can be turned into a direction in the real world. Without calibration, a hand reaching for a seen object will miss.

-- Image processing with OpenCV --
OpenCV is a free library for images. Learn to: read and show frames, resize and convert colours, detect edges and colours, find contours, and draw results. Many simple robot tasks (follow a coloured ball, read a marker) need nothing more.

-- Object detection --
Detectors such as YOLO find objects in an image and draw boxes with labels and confidence scores. The usual workflow:
1. Collect images from your own robot camera in your own lighting
2. Label them
3. Train or fine-tune a model
4. Test on new images and note failures
5. Run it on the robot at a speed it can keep up with
Models trained on internet pictures often struggle with your lighting and camera, so your own data is valuable.

-- From pixels to the world --
A detection box plus a depth reading gives a 3D position. Convert it from the camera frame to the robot frame (Module 2) before planning a reach.

-- Knowing where you are --
Localisation and mapping (SLAM) let a robot build a map while tracking its own position, using cameras or a laser scanner. Even if your capstone is stationary, understanding the idea helps you read robot papers and products.

-- Sensor fusion --
Combine sensors to cover each other's weaknesses: IMU plus camera, wheel or joint data plus vision. A simple filter often beats a clever single sensor.

-- Know the failure modes --
Detectors fail with glare, dark scenes, clutter, unusual angles and objects they never saw. Decide in advance what the robot does when it is unsure: stop, ask, or look again.

! Privacy -- A camera and microphone on a robot record people. Tell users, store as little as possible, and never record in private places without permission.

What you will learn in this module
* RGB and depth cameras and why calibration matters
* The object detection workflow and why your own data helps
* Converting from pixels to robot coordinates
* Failure modes and privacy$t$);

  /* ───────────────────────── Module 10 ───────────────────────── */
  insert into public.modules (course_id, title, position) values (v_course, 'Module 10: AI for Robots', 9) returning id into v_mod;
  insert into public.lessons (module_id, title, position, kind, content) values (v_mod, 'AI for Robots', 0, 'article', $t$Duration: 5h

-- Why this matters --
This is the module the course title promises. AI gives a robot the ability to recognise, decide and learn. But AI is also unpredictable, so you must learn where to use it and where to keep it away from the motors.

-- Machine learning in short --
* Supervised learning: learn from labelled examples (an image and the word "cup"). This powers detection and speech recognition
* Unsupervised learning: find patterns without labels
* Reinforcement learning (RL): an agent tries actions, receives a reward, and learns what works. The robot is the agent, its sensor readings are the state, its motor commands are the actions, and a score you design is the reward

-- Reinforcement learning for movement --
RL has taught simulated and real legged robots to walk, run and recover from pushes. Training takes millions of attempts, so it is done in simulation, and the learned controller is then moved to the real robot.

-- The sim-to-real gap --
A simulator is never exactly like reality: friction, motor delay and sensor noise differ. Domain randomisation helps by training with many random variations (different masses, frictions and delays) so the policy copes with real-world differences. Always test the result carefully on a stand before letting it walk.

-- Imitation learning --
Instead of designing a reward, show the robot what to do. A person controls the robot (teleoperation) or moves its arms, the system records the camera images and joint data, and a neural network learns to copy the behaviour. It works well for manipulation tasks such as picking and placing, and it needs a lot of good demonstrations.

-- Language and vision models as the planner --
Large language models and vision-language models can turn a request like "bring me the red cup" into a list of steps: find the cup, walk to it, grasp it, come back. They are useful as a high-level planner. They are not reliable enough to control motors directly.

-- The golden rule: AI above, safety below --
A sensible design has layers:
1. AI planner (slowest): chooses which skill to use
2. Skill library: tested skills such as "wave", "pick up object", "walk forward 1 m", each with limits
3. Controllers: balance and joint control (fast)
4. Safety layer: hard limits and an emergency stop
The AI may only request skills from the list, with parameters checked against limits. It can never send raw motor commands.

-- Honest limits --
Models can be confident and wrong. Test with many cases, log what the robot did and why, keep a human able to stop it, and decide what happens when it is unsure.

-- Where the computing happens --
Small boards such as a Jetson can run vision models on the robot (low delay, works offline). Cloud services are more powerful but add delay, need a connection, and send data away. Use on-robot processing for anything urgent.

! Rule -- Never let a language model's text answer directly move a joint or open a gripper without a checked skill in between.

What you will learn in this module
* Supervised learning, reinforcement learning and imitation learning
* Simulation, domain randomisation and the sim-to-real gap
* How to use language models safely as planners
* The layered design: AI above, safety below$t$);

  /* ───────────────────────── Module 11 ───────────────────────── */
  insert into public.modules (course_id, title, position) values (v_course, 'Module 11: Talking and Working With People', 10) returning id into v_mod;
  insert into public.lessons (module_id, title, position, kind, content) values (v_mod, 'Talking and Working With People', 0, 'article', $t$Duration: 3h

-- Why this matters --
A humanoid's whole point is to work with people. That needs speech, clear behaviour and above all safety around humans.

-- Speech in, speech out --
* Wake word: a small model that listens for a name such as "Hey robot", so the robot is not recording constantly
* Speech recognition (ASR): turns audio into text. Noise, accents and distance cause errors, so use a good microphone near the robot's head and confirm important commands
* Dialogue and intent: map the text to one of the robot's known skills ("wave", "stand up", "look at me")
* Text to speech (TTS): the robot speaks its answer or states what it is about to do

-- Make behaviour readable --
People feel safe when they can guess what a robot will do. Use head and eye direction to show attention, announce actions ("I am going to pick up the cup"), use lights or sounds for states, and move at gentle speeds near people.

-- Safe distance and force --
* Limit speed and force near people; light, slow, compliant motion is safer
* Keep sharp edges and pinch points covered
* Stop when someone enters a protected zone
* Industrial standards give guidance: ISO 10218 for industrial robots, ISO/TS 15066 for robots working alongside people, and ISO 13482 for personal care robots. You do not need to memorise them now, but know they exist
A small educational robot is much lower risk than a full-size one, but the habits are the same.

-- Fail gracefully --
When the robot does not understand, it should say so and ask again or do nothing. When a sensor fails, it should stop safely rather than guess. When it falls, it should relax and signal it.

-- Privacy, honesty and ethics --
* Tell people what the robot records and why; keep recordings private and short-lived
* Do not pretend the robot is a person or has feelings it does not have
* Think about who might be harmed, left out or deceived by what you build
* Accessibility: voice, touch and screen options help more people use the robot

! Rule -- A person must always be able to stop the robot quickly: a physical emergency stop within reach, and a spoken "stop" that the robot treats as the highest priority.

What you will learn in this module
* The speech pipeline from wake word to text to speech
* How to make robot behaviour clear and predictable
* Safe distance, speed and force around people
* Privacy and ethics basics$t$);

  /* ───────────────────────── Module 12 ───────────────────────── */
  insert into public.modules (course_id, title, position) values (v_course, 'Module 12: Capstone: Build and Demo an AI Humanoid', 11) returning id into v_mod;
  insert into public.lessons (module_id, title, position, kind, content) values (v_mod, 'Capstone: Build and Demo an AI Humanoid', 0, 'article', $t$Duration: 8h

-- Why this matters --
Now you put everything together. The capstone is a small humanoid (hobby scale) that stands, moves, sees and responds. The goal is a robot that works safely and a clear account of how you built it, not a record-breaking machine.

-- Scope it small --
Choose a goal you can finish:
* Stand and balance with the robot held on a stand, then standing on its own
* Wave or point when it sees a person (camera plus detection plus a motion skill)
* Respond to three spoken commands ("wave", "sit", "look left")
* Optional stretch: take a few steps on a stand or with a harness
Write the goal in one sentence and a list of what counts as success.

-- Suggested plan --
1. Week 1: requirements, power budget, parts list, safety plan
2. Week 2: build and wire the body, test every joint on a stand with limits
3. Week 3: write the control loop, calibrate joint zero positions, make smooth motions
4. Week 4: add the IMU and balance, test with a harness
5. Week 5: add the camera, detection and the skills (wave, look)
6. Week 6: add speech, the AI planner and the safety layer; rehearse the demo

-- Safety review checklist --
* Battery with a fuse, protected wiring and a safe charging place
* Physical emergency stop that cuts motor power
* Joint limits, speed limits and current limits tested
* Watchdog: the robot stops when commands stop arriving
* AI limited to a list of tested skills
* Test area clear, with a hanging stand or harness for risky tests
* Someone other than the builder checks the list

-- Test like an engineer --
Write down what you will test, run it, and record the result. Log joint angles, tilt and commands. Change one thing at a time. Keep a notebook of failures and what fixed them; it is the most valuable part of your project.

-- The demo --
Prepare a short script: introduce the robot, show the safety features, then show each skill. Plan for failure: a backup recording, spare batteries and a calm explanation if something goes wrong. A demo that fails safely and is explained well is a good demo.

-- Documentation to hand in --
* Photos or short videos
* Wiring diagram and parts list
* Code in a Git repository with a short readme
* Test log and the safety checklist
* A page on what you would improve next

-- What next --
Learn ROS 2 in depth, try a physics simulator such as MuJoCo or PyBullet, study control and reinforcement learning, join open-source robotics projects, and keep building. Roles to aim for include robotics software engineer, controls engineer, perception engineer, and mechatronics engineer.

! Final rule -- If you are not sure it is safe, do not power it. Ask a mentor first.

What you will learn in this module
* How to scope, plan and finish a robotics project
* A complete safety review
* How to test, log and document
* How to run a clear, honest demo$t$);

  /* ───────────────────────── Question bank (49) ───────────────────────── */
  -- Module 1
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[2], $q$What are the three steps of the loop every robot runs again and again?
Think, plan, rest
Sense, think, act
Charge, move, stop
Listen, speak, wait
The robot reads its sensors, decides what to do, then commands its motors, and repeats.$q$);
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[3], $q$What makes a robot "AI-based"?
Having a human-shaped body
Having strong motors
Software that uses AI to perceive, decide or learn
Having many sensors
AI is the brain of the robot: the body alone, however human-like, is not AI.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[1], $q$Why should you be careful when watching impressive humanoid robot videos?
Parts may be remote-controlled, edited or carefully staged
Humanoid robots never work in real life
Videos are always live and unedited
Only the legs are real
Ask what was automatic: many demos use teleoperation, editing or very controlled settings.$q$);
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[2], $q$Which part of a humanoid usually runs the fastest loop, hundreds of times per second?
Recognising objects in pictures
Balance and joint control
Understanding a spoken request
Planning a long task
Balance control must react very quickly; recognition and planning run much more slowly.$q$);

  -- Module 2
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[3], $q$180 degrees is equal to how many radians?
1
2
3.14159 (pi)
6.28
Half a turn is pi radians; a full turn is 2 x pi.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[2], $q$A 0.5 kg hand is held 0.3 m from the shoulder joint. About how much torque is needed just to hold it still? (g = 9.8)
0.15 N.m
1.5 N.m
15 N.m
0.5 N.m
Torque = force x distance = (0.5 x 9.8) x 0.3, about 1.5 N.m.$q$);
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[1], $q$A gearbox with a 10:1 ratio mainly does what?
Trades speed for about 10 times more torque
Makes the motor use no power
Increases both speed and torque by 10
Removes all backlash
Gears give more torque and less speed, with some losses and backlash.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[4], $q$A humanoid stays upright while standing still only if the ground projection of its centre of mass is where?
Behind the robot
In front of the toes
Anywhere on the ground
Inside the area covered by the feet
That area is the support polygon; outside it the robot tips.$q$);

  -- Module 3
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[2], $q$What is the nominal voltage of one lithium polymer (LiPo) cell?
1.5 V
3.7 V
5 V
12 V
A cell is about 3.7 V nominal (4.2 V fully charged); a 2S pack is about 7.4 V.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[3], $q$A motor draws 2 A from a 7.4 V battery. About how much power does it use?
3.7 W
7.4 W
15 W
30 W
Power = voltage x current = 7.4 x 2, about 15 W.$q$);
  perform pg_temp.addq(v_course, v_owner, 'easy', 'multi', array[1,2,4], $q$Which of these are good LiPo safety habits? (select all that apply)
Use a balance charger and never leave it charging unattended
Add a fuse near the battery
Short the terminals to test it
Avoid discharging each cell far below about 3.3 V
Never short a pack, never leave it charging unattended, and protect the wiring with a fuse.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[1], $q$Why power the computer from a separate regulator from the servos?
So the computer does not reset when the servos draw heavy current
Because computers need no power
So the servos run slower
To make the robot lighter
Servo current spikes can pull the voltage down and reset the computer.$q$);
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[2], $q$What does an IMU measure?
Battery charge
Motion and tilt (gyroscope and accelerometer)
Colour of objects
Sound level
An IMU combines a gyroscope and an accelerometer to sense tilt and movement.$q$);

  -- Module 4
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[3], $q$What is a degree of freedom (DoF)?
A type of battery
A measurement of temperature
One independent way a joint can move
The weight of a robot
A hinge joint has one DoF; a hip with three rotations has three.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[2], $q$Where should heavy parts such as the battery and computer be placed in a humanoid?
High up in the head
Low and close to the centre of the body
At the ends of the arms
As far from the body as possible
A low, central centre of mass makes balance much easier.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[4], $q$A joint needs 2 N.m in the worst case. Which actuator is the safest choice?
One rated 1 N.m
One rated 2 N.m exactly
One rated 2.1 N.m
One rated about 4 N.m
Keep a margin of about twice the worst-case torque.$q$);
  perform pg_temp.addq(v_course, v_owner, 'hard', 'single', array[3], $q$What is backlash in a gearbox?
The weight of the gears
The noise a motor makes
Small slack between meshing gears that lets the output move without the input
The heat produced by friction
Backlash makes positioning less exact and can cause vibration in control.$q$);

  -- Module 5
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[1], $q$Why is a robot's control loop run at a fixed rate such as 100 times per second?
Steady timing is needed for stable control
It saves paper
Because Python cannot run faster
It makes the motors cooler
Uneven timing (jitter) harms balance and tuning.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[2], $q$What is a watchdog in robot software?
A camera that watches people
A check that stops the robot safely if commands stop arriving
A program that records video
A battery monitor
If the main program freezes, the watchdog makes the robot go limp or hold safely.$q$);
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[3], $q$In ROS 2, what is a topic?
A type of motor
A file on the hard disk
A named channel nodes use to publish and receive messages
A kind of sensor
Nodes publish messages to a topic and other nodes subscribe to it.$q$);
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[2], $q$Why test in a simulator before running on the real robot?
Simulators are always exactly right
A bug in simulation costs nothing, but on hardware it can break parts
Simulators make the robot stronger
Real robots cannot be programmed
Simulation is a safe place to find mistakes first.$q$);

  -- Module 6
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[1], $q$Forward kinematics answers which question?
Given the joint angles, where is the hand?
Given the target, what are the angles?
How heavy is the robot?
How fast is the battery draining?
Forward kinematics goes from angles to position; inverse goes the other way.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[3], $q$A two-link arm has L1 = L2 = 0.1 m. What happens when you ask the hand to reach a point 0.3 m away?
It reaches it with the elbow up
It reaches it with the elbow down
It is out of reach, because the arm can only stretch to 0.2 m
It reaches it with a faster motor
The maximum reach is L1 + L2 = 0.2 m, so 0.3 m is impossible.$q$);
  perform pg_temp.addq(v_course, v_owner, 'hard', 'single', array[2], $q$What is a kinematic singularity?
A very fast joint
A position, such as a fully straight arm, where small hand movements need huge joint movements
A broken sensor
A type of gear
Near a singularity, control becomes difficult, so good code slows down or avoids it.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[4], $q$Why should you check inverse kinematics results against joint limits?
To make the arm heavier
To change the battery
To reduce the camera resolution
Because a mathematically correct answer may be a position the real joint cannot reach
Always compare the solution with limits and possible collisions before sending it.$q$);

  -- Module 7
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[2], $q$What is the support polygon?
The shape of the robot's head
The area under and between the feet
The area covered by the camera
The shape of the battery
The robot is statically stable while its centre of mass projects inside it.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[1], $q$In a complementary filter, why combine a gyroscope with an accelerometer?
The gyroscope is fast but drifts, the accelerometer is steady but noisy, so together they are better
Because both are equally accurate alone
To reduce battery use
To make the robot heavier
The blend gives a stable and responsive tilt estimate.$q$);
  perform pg_temp.addq(v_course, v_owner, 'hard', 'single', array[3], $q$In the linear inverted pendulum model, a taller robot generally does what?
Falls faster
Cannot balance at all
Falls more slowly, which can make it easier to balance
Uses no energy
The rate depends on the square root of g divided by the height, so greater height means slower falling.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'multi', array[1,3,4], $q$Which of these are sensible precautions when testing balance and walking? (select all that apply)
Use a safety harness or hanging stand
Test with people standing close to the robot
Keep a hand-held emergency stop ready
Test on a smooth, level surface first
Keep people away, use a harness and an emergency stop, and start on a level surface.$q$);

  -- Module 8
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[2], $q$What is the "error" in a feedback controller?
The number of motors
The difference between the goal and the measured value
A software crash
The battery voltage
The controller works to make this difference small.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[3], $q$What does the D (derivative) term in a PID controller do?
Removes steady offsets by adding up past error
Pushes in proportion to the present error
Reacts to how fast the error is changing, to calm overshoot
Sets the battery limit
D damps the motion, but too much amplifies sensor noise.$q$);
  perform pg_temp.addq(v_course, v_owner, 'hard', 'single', array[1], $q$What is integral windup?
The integral term grows too large while the motor output is saturated, causing overshoot later
A cable wrapping around a joint
A loss of battery capacity
Noise in the camera image
Anti-windup stops the integral from growing while the output is clamped.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[4], $q$Why move along a smooth trajectory instead of jumping straight to a new angle?
It uses more power
It is required by law
It makes the robot taller
Large sudden accelerations are noisy, stress the gears and are less safe
Smooth paths keep accelerations small.$q$);
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[2], $q$What should the safety layer of a robot do if the AI program above it crashes?
Stop working too
Keep enforcing limits and be able to stop the robot
Delete the program
Turn on more motors
The lowest safety layer must work regardless of higher software.$q$);

  -- Module 9
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[3], $q$What does a depth camera provide that an ordinary RGB camera does not?
Colour
Sound
The distance to points in the scene
Battery power
Depth cameras measure how far away each pixel is.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[1], $q$Why is it valuable to train an object detector on images from your own robot camera?
Your own lighting and camera differ from internet pictures, so results are more reliable
Because internet pictures are illegal
Because it makes the model smaller
Because it removes the need for labels
Matching the real conditions improves detection.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[2], $q$What is camera calibration used for?
Making the picture brighter
Measuring the camera's properties so pixels can be turned into real-world directions
Charging the camera
Compressing the video
Without calibration, reaching for a seen object will miss.$q$);
  perform pg_temp.addq(v_course, v_owner, 'hard', 'single', array[4], $q$A detector reports an object with low confidence. What is the best design choice?
Act on it anyway
Turn off the camera
Increase motor speed
Decide in advance to stop, look again or ask a person
Plan what the robot does when it is unsure, rather than guessing.$q$);

  -- Module 10
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[3], $q$In reinforcement learning, what does the agent receive after an action?
A new battery
A bigger motor
A reward (a score) telling it how good the outcome was
A new camera
The agent learns to choose actions that earn higher reward.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[2], $q$What is the sim-to-real gap?
A shortage of simulators
The differences between a simulator and the real world, such as friction and delays
The distance between two robots
The time a robot needs to charge
Policies trained in simulation may behave differently on real hardware.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[1], $q$How does domain randomisation help with the sim-to-real gap?
Training with many random variations makes the policy cope with real-world differences
It makes the simulator run faster
It removes the need for testing
It gives the robot more motors
Varying mass, friction and delay during training makes the policy more robust.$q$);
  perform pg_temp.addq(v_course, v_owner, 'hard', 'single', array[3], $q$What is the safest way to use a large language model in a humanoid?
Let it send raw motor commands
Give it control of the emergency stop
Let it choose from a list of tested skills whose parameters are checked against limits
Let it rewrite the safety software
The model plans at a high level; checked skills and a safety layer keep the robot safe.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[4], $q$What is imitation learning?
Copying another robot's battery
Training without any data
Making the robot imitate sounds only
Learning to copy behaviour from demonstrations, for example from a person teleoperating the robot
The robot records the camera and joint data from demonstrations and learns to reproduce them.$q$);

  -- Module 11
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[2], $q$What is the purpose of a wake word?
To make the robot walk
To let the robot listen for its name so it is not recording everything all the time
To charge the battery
To change the camera
A small model listens for the wake word and only then processes speech.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[1], $q$Which approach is safest near people?
Slow, light, compliant motion with limited force and a quick emergency stop
Fast, rigid motion
Hidden sharp edges
Removing the emergency stop
Limit speed and force, cover pinch points and keep a stop within reach.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'single', array[3], $q$What should a robot do when it does not understand a spoken command?
Guess and act
Ignore safety
Say it did not understand and ask again or do nothing
Run faster
Failing gracefully avoids unintended actions.$q$);

  -- Module 12
  perform pg_temp.addq(v_course, v_owner, 'easy', 'single', array[2], $q$What should you do if you are not sure a robot test is safe?
Power it on and see
Do not power it and ask a mentor first
Remove the emergency stop
Increase the speed
When in doubt, do not power it.$q$);
  perform pg_temp.addq(v_course, v_owner, 'medium', 'multi', array[1,2,4], $q$Which items belong on a capstone safety review checklist? (select all that apply)
Battery fuse and protected wiring
A physical emergency stop that cuts motor power
Letting the AI send any command it likes
A watchdog that stops the robot when commands stop
The robot needs fused wiring, an emergency stop and a watchdog, and the AI must be limited to tested skills.$q$);
  perform pg_temp.addq(v_course, v_owner, 'hard', 'single', array[1], $q$You change two things at once and the robot starts to wobble. What is the better testing habit?
Change one thing at a time and log the results
Change everything again
Stop recording data
Remove the safety layer
Changing one variable at a time shows what caused the change.$q$);
end
$course$;
