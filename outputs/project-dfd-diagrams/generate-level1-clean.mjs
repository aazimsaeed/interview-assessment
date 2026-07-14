import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const outDir = process.argv[2];
const W = 2200, H = 1300;
const esc = (v) => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function text(x,y,lines,cls='small',anchor='middle',lh=24){const a=Array.isArray(lines)?lines:[lines];return `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${a.map((l,i)=>`<tspan x="${x}" dy="${i?lh:0}">${esc(l)}</tspan>`).join('')}</text>`}
function start(){return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><marker id="arrow" markerWidth="16" markerHeight="16" refX="13" refY="8" orient="auto" markerUnits="strokeWidth"><path d="M2,2 L14,8 L2,14 Z" fill="#111"/></marker><style>.title{font-family:Arial,Helvetica,sans-serif;font-size:46px;font-weight:800;fill:#111}.subtitle{font-family:Arial,Helvetica,sans-serif;font-size:20px;fill:#333}.heading{font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:800;fill:#111}.procNo{font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;fill:#111}.small{font-family:Arial,Helvetica,sans-serif;font-size:18px;fill:#111}.tiny{font-family:Arial,Helvetica,sans-serif;font-size:15px;fill:#111}.label{font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;fill:#111}.entity,.process,.store{fill:#fff;stroke:#111;stroke-width:3}.flow{fill:none;stroke:#111;stroke-width:2.8;marker-end:url(#arrow)}</style></defs><rect width="${W}" height="${H}" fill="#fff"/>${text(W/2,70,'Level 1 DFD - Main Processes','title')}${text(W/2,112,'Decomposition of the AI Interview Assessment System','subtitle')}`}
const end=()=>`</svg>`;
function entity(x,y,w,h,name,details=[]){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="entity"/>${text(x+w/2,y+54,name,'heading')}${details.length?text(x+w/2,y+90,details,'small','middle',25):''}`}
function proc(x,y,w,h,no,name,details=[]){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" class="process"/>${text(x+30,y+34,no,'procNo','start')}${text(x+w/2,y+63,name,'heading')}${details.length?text(x+w/2,y+98,details,'tiny','middle',20):''}`}
function store(x,y,w,h,id,name,details=[]){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="store"/><line x1="${x+20}" y1="${y}" x2="${x+20}" y2="${y+h}" stroke="#111" stroke-width="3"/>${text(x+42,y+32,id,'procNo','start')}${text(x+42,y+62,name,'small','start')}${details.length?text(x+42,y+88,details,'tiny','start',19):''}`}
function label(x,y,s,w=180){return `<rect x="${x-w/2}" y="${y-22}" width="${w}" height="32" fill="#fff"/>${text(x,y,s,'label')}`}
function flow(d,s,x,y,w=180){return `<path d="${d}" class="flow"/>${s?label(x,y,s,w):''}`}
const svg = `${start()}
${entity(70,250,265,150,'CANDIDATE',['profile, jobs,','interviews'])}
${entity(70,825,265,150,'RECRUITER',['ads, candidates,','assessments'])}
${entity(1730,190,270,135,'EMAILJS',['OTP and profile','verification'])}
${entity(1730,590,270,135,'GEMINI AI',['AI generation','evaluation'])}
${entity(1730,790,270,135,'ADMIN',['monitor and','manage'])}
${proc(430,190,300,120,'1.0','AUTH & PROFILE',['login, register, OTP,','profile updates'])}
${proc(430,390,300,120,'2.0','JOB BOARD',['ads, applications,','candidate links'])}
${proc(430,590,300,120,'3.0','ASSESSMENT SETUP',['role, questions,','session creation'])}
${proc(430,790,300,120,'4.0','LIVE MONITOR',['camera, mic, metrics,','snapshots, timeline'])}
${proc(870,590,300,120,'5.0','AI SERVICES',['question generation,','answer evaluation'])}
${proc(870,790,300,120,'6.0','REPORTS',['dashboard, rankings,','PDF export'])}
${proc(1290,690,300,120,'7.0','ADMIN MANAGEMENT',['users, ads, sessions,','report cleanup'])}
${store(1300,190,290,90,'D1','USERS',['recruiters, candidates, admins'])}
${store(1300,390,290,90,'D2','ADS & APPLICATIONS',['advertisements, applications'])}
${store(1300,590,290,90,'D3','INTERVIEWS',['session id, role, questions'])}
${store(1300,790,290,90,'D4','REPORTS',['metrics, timeline, snapshots'])}
${store(1300,990,290,90,'D5','HIDDEN SESSIONS',['role, interview id'])}
${flow('M335 302 L430 245','',0,0)}
${flow('M335 330 L430 450','',0,0)}
${flow('M335 375 C360 500 380 750 430 845','',0,0)}
${flow('M335 875 C390 760 400 540 430 465','',0,0)}
${flow('M335 925 L430 650','',0,0)}
${flow('M1170 850 C840 1030 500 1035 335 920','',0,0)}
${flow('M730 248 L1300 235','user records',1015,218,145)}
${flow('M730 448 L1300 435','ads/apps store',1015,418,160)}
${flow('M730 648 L1300 635','session store',1015,615,155)}
${flow('M730 648 L870 648','AI questions',800,628,140)}
${flow('M730 850 L870 850','metrics',800,830,95)}
${flow('M730 820 C785 720 820 660 870 650','answer text',800,735,130)}
${flow('M1170 650 L1730 650','prompt/result',1450,630,145)}
${flow('M1020 710 L1020 790','score',1050,753,80)}
${flow('M1170 850 L1300 835','report data',1235,815,135)}
${flow('M730 220 C1010 115 1450 125 1730 245','OTP request',1230,132,135)}
${flow('M1730 858 L1590 750','admin actions',1660,792,160)}
${flow('M1440 810 L1440 990','hide/delete',1480,905,130)}
${end()}`;
await fs.writeFile(path.join(outDir,'dfd-level-1-main-processes.svg'), svg, 'utf8');
const browser = await chromium.launch({headless:true,args:['--disable-gpu']});
const page = await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
await page.goto('file:///' + path.resolve(path.join(outDir,'dfd-level-1-main-processes.svg')).replace(/\\/g,'/'), {waitUntil:'load'});
await page.locator('svg').screenshot({path:path.join(outDir,'dfd-level-1-main-processes.png'),timeout:120000});
await browser.close();
const stat = await fs.stat(path.join(outDir,'dfd-level-1-main-processes.png'));
console.log(`dfd-level-1-main-processes.png\t${stat.size}`);


