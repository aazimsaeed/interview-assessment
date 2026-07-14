import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = process.argv[2];
const W = 2200;
const H = 1300;
const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function text(x, y, lines, cls = 'small', anchor = 'middle', lh = 24) {
  const arr = Array.isArray(lines) ? lines : [lines];
  return `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${arr.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lh}">${esc(line)}</tspan>`).join('')}</text>`;
}
function start(title, subtitle) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <marker id="arrow" markerWidth="16" markerHeight="16" refX="13" refY="8" orient="auto" markerUnits="strokeWidth"><path d="M2,2 L14,8 L2,14 Z" fill="#111"/></marker>
    <style>
      .title{font-family:Arial,Helvetica,sans-serif;font-size:46px;font-weight:800;fill:#111;letter-spacing:0}
      .subtitle{font-family:Arial,Helvetica,sans-serif;font-size:20px;fill:#333;letter-spacing:0}
      .heading{font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:800;fill:#111;letter-spacing:0}
      .procNo{font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;fill:#111;letter-spacing:0}
      .small{font-family:Arial,Helvetica,sans-serif;font-size:18px;fill:#111;letter-spacing:0}
      .tiny{font-family:Arial,Helvetica,sans-serif;font-size:15px;fill:#111;letter-spacing:0}
      .label{font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;fill:#111;letter-spacing:0}
      .entity{fill:#fff;stroke:#111;stroke-width:3}.process{fill:#fff;stroke:#111;stroke-width:3}.store{fill:#fff;stroke:#111;stroke-width:3}
      .flow{fill:none;stroke:#111;stroke-width:2.8;marker-end:url(#arrow)}
    </style>
  </defs><rect width="${W}" height="${H}" fill="#fff"/>${text(W / 2, 70, title, 'title')}${text(W / 2, 112, subtitle, 'subtitle')}`;
}
const end = () => '\n</svg>';
function entity(x, y, w, h, name, details = []) { return `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="entity"/>${text(x + w / 2, y + 54, name, 'heading')}${details.length ? text(x + w / 2, y + 90, details, 'small', 'middle', 25) : ''}`; }
function proc(x, y, w, h, no, name, details = []) { return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" class="process"/>${text(x + 30, y + 34, no, 'procNo', 'start')}${text(x + w / 2, y + 63, name, 'heading')}${details.length ? text(x + w / 2, y + 98, details, 'tiny', 'middle', 20) : ''}`; }
function store(x, y, w, h, id, name, details = []) { return `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="store"/><line x1="${x + 20}" y1="${y}" x2="${x + 20}" y2="${y + h}" stroke="#111" stroke-width="3"/>${text(x + 42, y + 32, id, 'procNo', 'start')}${text(x + 42, y + 62, name, 'small', 'start')}${details.length ? text(x + 42, y + 88, details, 'tiny', 'start', 19) : ''}`; }
function label(x, y, s, w = 190, h = 32) { return `<rect x="${x - w / 2}" y="${y - 22}" width="${w}" height="${h}" fill="#fff"/>${text(x, y, s, 'label')}`; }
function flow(d, s, x, y, w = 190) { return `<path d="${d}" class="flow"/>${s ? label(x, y, s, w) : ''}`; }

function level0() {
  return `${start('Level 0 DFD - Context Diagram', 'AI Interview Assessment System')}
  ${entity(100, 230, 290, 155, 'CANDIDATE', ['register/login', 'apply and interview'])}
  ${entity(100, 875, 290, 155, 'RECRUITER', ['post jobs', 'create assessments'])}
  ${entity(1810, 230, 290, 155, 'ADMIN', ['manage users', 'view system data'])}
  ${entity(1810, 555, 290, 155, 'GEMINI AI', ['questions', 'answer scoring'])}
  ${entity(1810, 875, 290, 155, 'EMAIL SERVICE', ['OTP delivery', 'verification mail'])}
  ${proc(760, 505, 680, 300, '0.0', 'AI INTERVIEW ASSESSMENT SYSTEM', ['authentication, job board, interview setup,', 'live monitoring, AI evaluation, reports'])}
  ${flow('M390 305 C520 305 615 430 760 575', 'signup, apply, answers', 555, 383, 235)}
  ${flow('M760 635 C615 575 520 385 390 375', 'jobs, questions, report', 560, 557, 235)}
  ${flow('M390 952 C560 930 635 790 760 715', 'jobs, approvals, questions', 572, 850, 260)}
  ${flow('M760 755 C625 835 540 940 390 1000', 'applications, rankings, reports', 560, 792, 280)}
  ${flow('M1810 305 C1655 320 1565 465 1440 575', 'admin requests', 1625, 405, 185)}
  ${flow('M1440 635 C1565 590 1655 385 1810 375', 'stats, users, sessions', 1630, 560, 220)}
  ${flow('M1440 625 L1810 625', 'generate/evaluate', 1625, 607, 210)}
  ${flow('M1810 665 L1440 680', 'AI result', 1625, 700, 120)}
  ${flow('M1440 745 C1590 795 1665 895 1810 952', 'OTP request', 1620, 843, 150)}
  ${flow('M1810 1000 C1660 985 1585 835 1440 765', 'delivery status', 1625, 1016, 170)}
  ${end()}`;
}

function level1() {
  return `${start('Level 1 DFD - Main Processes', 'Decomposition of the AI Interview Assessment System')}
  ${entity(70, 250, 265, 150, 'CANDIDATE', ['profile, jobs,', 'interviews'])}
  ${entity(70, 825, 265, 150, 'RECRUITER', ['ads, candidates,', 'assessments'])}
  ${entity(1730, 190, 270, 135, 'EMAILJS', ['OTP and profile', 'verification'])}
  ${entity(1730, 590, 270, 135, 'GEMINI AI', ['AI generation', 'evaluation'])}
  ${entity(1730, 790, 270, 135, 'ADMIN', ['monitor and', 'manage'])}

  ${proc(430, 190, 300, 120, '1.0', 'AUTH & PROFILE', ['login, register, OTP,', 'profile updates'])}
  ${proc(430, 390, 300, 120, '2.0', 'JOB BOARD', ['ads, applications,', 'candidate links'])}
  ${proc(430, 590, 300, 120, '3.0', 'ASSESSMENT SETUP', ['role, questions,', 'session creation'])}
  ${proc(430, 790, 300, 120, '4.0', 'LIVE MONITOR', ['camera, mic, metrics,', 'snapshots, timeline'])}
  ${proc(870, 590, 300, 120, '5.0', 'AI SERVICES', ['question generation,', 'answer evaluation'])}
  ${proc(870, 790, 300, 120, '6.0', 'REPORTS', ['dashboard, rankings,', 'PDF export'])}
  ${proc(1290, 690, 300, 120, '7.0', 'ADMIN MANAGEMENT', ['users, ads, sessions,', 'report cleanup'])}

  ${store(1300, 190, 290, 90, 'D1', 'USERS', ['recruiters, candidates, admins'])}
  ${store(1300, 390, 290, 90, 'D2', 'ADS & APPLICATIONS', ['advertisements, applications'])}
  ${store(1300, 590, 290, 90, 'D3', 'INTERVIEWS', ['session id, role, questions'])}
  ${store(1300, 790, 290, 90, 'D4', 'REPORTS', ['metrics, timeline, snapshots'])}
  ${store(1300, 990, 290, 90, 'D5', 'HIDDEN SESSIONS', ['role, interview id'])}

  ${flow('M335 302 L430 245', 'credentials', 385, 252, 135)}
  ${flow('M335 330 L430 450', 'browse/apply', 385, 388, 145)}
  ${flow('M335 370 C380 500 380 775 430 850', 'take interview', 372, 610, 155)}
  ${flow('M1170 865 C850 1030 520 785 335 385', 'report view', 680, 1040, 130)}

  ${flow('M335 880 L430 450', 'post jobs/apps', 382, 670, 160)}
  ${flow('M335 900 L430 650', 'create assessment', 382, 770, 190)}
  ${flow('M335 930 C500 1050 720 955 870 855', 'view reports', 600, 1018, 135)}

  ${flow('M730 248 L1300 235', 'user records', 1015, 218, 145)}
  ${flow('M730 448 L1300 435', 'ads/apps', 1015, 418, 115)}
  ${flow('M730 648 L870 648', 'AI question help', 800, 628, 165)}
  ${flow('M730 675 L1300 635', 'interview session', 1015, 615, 180)}
  ${flow('M730 850 L870 850', 'metrics/timeline', 800, 830, 175)}
  ${flow('M730 820 C780 710 820 655 870 650', 'answer text', 800, 736, 130)}
  ${flow('M1170 650 L1730 650', 'prompt/result', 1450, 630, 145)}
  ${flow('M1020 710 L1020 790', 'score', 1050, 753, 80)}
  ${flow('M1170 850 L1300 835', 'report data', 1235, 815, 135)}
  ${flow('M730 220 C1010 115 1450 125 1730 245', 'OTP request', 1230, 132, 135)}
  ${flow('M1730 858 L1590 750', 'admin actions', 1660, 792, 160)}
  ${flow('M1440 810 L1440 990', 'hide/delete', 1480, 905, 130)}
  ${flow('M1290 730 C1190 655 1195 265 1300 240', 'manage data', 1228, 488, 140)}
  ${end()}`;
}

function level2() {
  return `${start('Level 2 DFD - Interview & Report Flow', 'Detailed decomposition of live monitoring, AI evaluation, and report saving')}
  ${entity(70, 520, 260, 150, 'CANDIDATE', ['starts session,', 'speaks answers'])}
  ${entity(70, 910, 260, 150, 'BROWSER / CDN', ['camera, mic,', 'MediaPipe models'])}
  ${entity(1880, 720, 245, 145, 'GEMINI AI', ['answer scoring', 'ideal answers'])}

  ${store(500, 230, 300, 95, 'D3', 'INTERVIEWS', ['candidate, role, questions'])}
  ${proc(500, 455, 280, 125, '4.1', 'LOAD SESSION', ['validate id, load', 'question queue'])}
  ${proc(850, 455, 280, 125, '4.2', 'CAPTURE MEDIA', ['camera/mic stream,', 'timer, controls'])}
  ${proc(1200, 455, 280, 125, '4.3', 'LANDMARK DETECTION', ['face, pose, hand', 'landmarks'])}
  ${proc(1550, 455, 280, 125, '4.4', 'BEHAVIOR ANALYSIS', ['lighting, gaze, posture,', 'blink, gesture, movement'])}
  ${proc(850, 740, 280, 125, '4.5', 'SPEECH & ANSWERS', ['transcript, WPM,', 'filler words'])}
  ${proc(1200, 740, 280, 125, '5.1', 'EVALUATE ANSWER', ['question + transcript,', 'score + feedback'])}
  ${proc(1550, 740, 280, 125, '6.1', 'BUILD REPORT', ['metrics, timeline,', 'snapshots'])}
  ${proc(1550, 1010, 280, 125, '6.2', 'SAVE / VIEW REPORT', ['dashboard, PDF,', 'history access'])}
  ${store(1880, 1030, 240, 95, 'D4', 'REPORTS', ['metrics, report'])}

  ${flow('M330 570 L500 515', 'interview id', 415, 524, 135)}
  ${flow('M640 325 L640 455', 'questions', 670, 392, 115)}
  ${flow('M780 518 L850 518', 'session data', 815, 498, 145)}
  ${flow('M1130 518 L1200 518', 'video frames', 1165, 498, 135)}
  ${flow('M1480 518 L1550 518', 'landmarks', 1515, 498, 115)}
  ${flow('M1690 580 L1690 740', 'behavior metrics', 1725, 665, 170)}
  ${flow('M330 620 C535 720 705 805 850 805', 'spoken answer', 610, 750, 155)}
  ${flow('M990 580 L990 740', 'audio stream', 1020, 665, 135)}
  ${flow('M1130 805 L1200 805', 'transcript', 1165, 785, 110)}
  ${flow('M1480 805 L1550 805', 'AI feedback', 1515, 785, 125)}
  ${flow('M1480 785 L1880 780', 'prompt', 1680, 760, 90)}
  ${flow('M1880 825 L1480 840', 'score', 1680, 855, 80)}
  ${flow('M1690 865 L1690 1010', 'report payload', 1730, 942, 155)}
  ${flow('M1830 1075 L1880 1075', 'save/read', 1855, 1055, 110)}
  ${flow('M1550 1075 C1120 1200 655 1165 330 650', 'report/dashboard', 950, 1180, 180)}
  ${flow('M330 975 C555 930 735 545 850 520', 'media access', 600, 900, 135)}
  ${flow('M330 1000 C650 990 1045 555 1200 530', 'models', 760, 1012, 90)}
  ${end()}`;
}

const diagrams = [
  { name: 'dfd-level-0-context', svg: level0() },
  { name: 'dfd-level-1-main-processes', svg: level1() },
  { name: 'dfd-level-2-interview-report-flow', svg: level2() },
];
await fs.mkdir(outDir, { recursive: true });
for (const diagram of diagrams) await fs.writeFile(path.join(outDir, `${diagram.name}.svg`), diagram.svg, 'utf8');
const captions = `Level 0 DFD: This context diagram represents the complete AI Interview Assessment System as a single process. Candidates, recruiters, administrators, Gemini AI, and the email service exchange data with the platform for authentication, job applications, assessment creation, live interviews, AI scoring, OTP delivery, and report access.\n\nLevel 1 DFD: This diagram decomposes the platform into its main processes: authentication and profile management, job board handling, assessment setup, live interview monitoring, AI services, reports, and admin management. It also shows how MongoDB stores users, advertisements, applications, interviews, reports, and hidden sessions.\n\nLevel 2 DFD: This detailed flow focuses on the live interview workflow. The system loads interview questions, captures camera and microphone input, runs MediaPipe-based analysis, transcribes answers, sends responses for AI evaluation, builds behavior and speech metrics, saves the report, and displays the final dashboard.`;
await fs.writeFile(path.join(outDir, 'dfd-captions.txt'), captions, 'utf8');
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
for (const diagram of diagrams) {
  const svgPath = path.join(outDir, `${diagram.name}.svg`);
  const pngPath = path.join(outDir, `${diagram.name}.png`);
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto('file:///' + path.resolve(svgPath).replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.locator('svg').screenshot({ path: pngPath, timeout: 120000 });
  await page.close();
}
await browser.close();
for (const item of (await fs.readdir(outDir)).filter((name) => name.endsWith('.png') || name.endsWith('.svg') || name.endsWith('.txt')).sort()) {
  const stat = await fs.stat(path.join(outDir, item));
  console.log(`${item}\t${stat.size}`);
}
