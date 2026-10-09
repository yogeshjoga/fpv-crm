export type EmailTemplateKey = 'interview' | 'shortlisted' | 'passed' | 'not_selected' | 'offer' | 'custom';

export const EMAIL_TEMPLATE_LABEL: Record<EmailTemplateKey, string> = {
  interview: 'Interview invitation and schedule',
  shortlisted: 'You are shortlisted',
  passed: 'Round cleared, next step to follow',
  not_selected: 'Application not taken forward',
  offer: 'Offer is on the way',
  custom: 'Write my own',
};

export interface EmailContext {
  orgName: string;
  candidate: string;
  jobTitle: string;
  jd: string;
  round?: { name: string; kind: string } | null;
  when?: string | null; // ISO
  interviewer?: string;
  link?: string;
}

const first = (name: string) => name.trim().split(/\s+/)[0] || 'there';

/** "Thu, 9 Oct 2026, 3:30 PM IST" */
export function istText(iso: string): string {
  return `${new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} IST`;
}

/**
 * What the candidate should prepare, taken from the job description: the bullets under the "what we look for" part,
 * or, when the text has no such heading, the first bullets of the whole description.
 */
export function jdTopics(jd: string, max = 6): string[] {
  const blocks = jd.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const bulletsOf = (b: string) => b.split('\n').filter((l) => /^\s*[-•*]\s+/.test(l)).map((l) => l.replace(/^\s*[-•*]\s+/, '').trim());
  const wanted = blocks.find((b) => /^(what we look for|requirements?|skills?|you bring|qualifications?)/i.test(b.split('\n')[0]));
  const picked = wanted ? bulletsOf(wanted) : blocks.flatMap(bulletsOf);
  return picked.filter(Boolean).slice(0, max);
}

function interviewBody(c: EmailContext): string {
  const r = c.round;
  const isHr = r?.kind === 'hr' || /hr/i.test(r?.name ?? '');
  const deeper = /\b(2|ii|two|second)\b/i.test(r?.name ?? '');
  const topics = jdTopics(c.jd);
  const lines: string[] = [];
  lines.push(`Hi ${first(c.candidate)},`);
  lines.push(`Thank you for applying for the ${c.jobTitle} position at ${c.orgName}. We would like to invite you to ${r ? `the ${r.name}` : 'an interview'}.`);
  const when = c.when ? istText(c.when) : 'We will confirm the date and time with you shortly';
  lines.push(
    [
      'Schedule',
      `- Date and time: ${when}`,
      c.interviewer ? `- With: ${c.interviewer}` : '',
      `- Where: ${c.link ? c.link : 'We will share the meeting link before the interview'}`,
      `- Duration: about ${isHr ? '20 to 30' : '45 to 60'} minutes`,
    ]
      .filter(Boolean)
      .join('\n'),
  );
  if (isHr) {
    lines.push('What to expect\nThis is a conversation about you, your expectations, your availability, the terms of the role and any questions you have for us. There is no test.');
  } else if (deeper) {
    lines.push('What to expect\nThis is a deeper technical round with the team. Expect practical problems and hands-on questions. Think aloud, because we care about how you reason as much as the final answer.');
  } else {
    lines.push('What to expect\nWe will talk about your projects, the skills this role needs and how you approach problems. Be ready to explain what you built and what you learned.');
  }
  if (!isHr) {
    lines.push(['What to prepare', ...(topics.length ? topics.map((t) => `- Be ready to talk about: ${t}`) : ['- Your projects and the skills listed in the job description']), '- Keep your resume, portfolio or project links handy'].join('\n'));
  } else {
    lines.push('What to prepare\n- Your expected stipend or salary and your joining date\n- Any questions about the role, the team or the terms\n- Your original documents, in case we need to check them');
  }
  lines.push('Please join 5 minutes early with a working camera and microphone, in a quiet place. If this time does not suit you, reply to this email and we will arrange another slot.');
  lines.push(`Regards,\nThe ${c.orgName} hiring team`);
  return lines.join('\n\n');
}

export function buildEmail(key: EmailTemplateKey, c: EmailContext): { subject: string; body: string } {
  const hi = `Hi ${first(c.candidate)},`;
  const sign = `Regards,\nThe ${c.orgName} hiring team`;
  switch (key) {
    case 'interview':
      return { subject: `Interview schedule: ${c.round?.name ?? 'Interview'} for ${c.jobTitle} at ${c.orgName}`, body: interviewBody(c) };
    case 'shortlisted':
      return {
        subject: `You are shortlisted for ${c.jobTitle} at ${c.orgName}`,
        body: [hi, `Thank you for applying for the ${c.jobTitle} position. We liked your application and you are shortlisted for the next stage.`, 'Our team will send you the interview schedule shortly. You can follow your application any time in the Careers section of your dashboard.', sign].join('\n\n'),
      };
    case 'passed':
      return {
        subject: `Update on your ${c.jobTitle} application at ${c.orgName}`,
        body: [hi, `Thank you for your time in ${c.round ? `the ${c.round.name}` : 'the interview'}. We are happy to tell you that you have cleared it.`, 'We will write to you soon with the details of the next step.', sign].join('\n\n'),
      };
    case 'not_selected':
      return {
        subject: `Your application for ${c.jobTitle} at ${c.orgName}`,
        body: [hi, `Thank you for your interest in the ${c.jobTitle} position and for the time you gave us.`, 'After careful review we are not able to take your application forward this time. This is not a judgement of your potential, and we encourage you to apply again when we open new positions.', `We wish you all the best.\n\n${sign}`].join('\n\n'),
      };
    case 'offer':
      return {
        subject: `Good news about your ${c.jobTitle} application at ${c.orgName}`,
        body: [hi, `Congratulations! Your interviews for the ${c.jobTitle} position went well and we would like to offer you the role.`, 'Your offer letter, with the start date, pay and terms, is on its way. Please read it carefully and reply or accept it in your Careers section.', sign].join('\n\n'),
      };
    default:
      return { subject: `About your application for ${c.jobTitle}`, body: [hi, '', sign].join('\n\n') };
  }
}
