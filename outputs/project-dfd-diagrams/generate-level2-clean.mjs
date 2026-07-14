import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const outDir = process.argv[2];
const W = 2200, H = 1300;
const esc = (v) => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function text(x,y,lines,cls='small',anchor='middle',lh=24){const a=Array.isArray(lines)?lines:[lines];return `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${a.map((l,i)=>`<tspan x="${x}" dy="${i?lh:0}">${esc(l)}</tspan>`).join('')}</text>`}
function start(){return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><marker id="arrow" markerWidth="16" markerHeight="16" refX="13" refY="8" orient="auto" markerUnits="strokeWidth"><path d="M2,2 L14,8 L2,14 Z" fill="#111"/></marker><style>.title{font-family:Arial,Helvetica,sans-serif;font-size:46px;font-weight:800;fill:#111}.subtitle{font-family:Arial,Helvetica,sans-serif;font-size:20px;fill:#333}.heading{font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:800;fill:#111}.procNo{font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;fill:#111}.small{font-family:Arial,Helvetica,sans-serif;font-size:18px;fill:#111}.tiny{font-family:Arial,Helvetica,sans-serif;font-size:15px;fill:#111}.label{font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;fill:#111}.entity,.process,.store{fill:#fff;stroke:#111;stroke-width:3}.flow{fill:none;stroke:#111;stroke-width:2.8;marker-end:url(#arrow)}</style></defs><rect width="${W}" height="${H}" fill="#fff"/>${text(W/2,70,'Level 2 DFD - Interview & Report Flow','title')}${text(W/2,112,'Detailed decomposition of live monitoring, AI evaluation, and report saving','subtitle')}`}
const end=()=>`</svg>`;
function entity(x,y,w,h,name,details=[]){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="entity"/>${text(x+w/2,y+54,name,'heading')}${details.length?text(x+w/2,y+90,details,'small','middle',25):''}`}
function proc(x,y,w,h,no,name,details=[]){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" class="process"/>${text(x+30,y+34,no,'procNo','start')}${text(x+w/2,y+63,name,'heading')}${details.length?text(x+w/2,y+98,details,'tiny','middle',20):''}`}
function store(x,y,w,h,id,name,details=[]){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="store"/><line x1="${x+20}" y1="${y}" x2="${x+20}" y2="${y+h}" stroke="#111" stroke-width="3"/>${text(x+42,y+32,id,'procNo','start')}${text(x+42,y+62,name,'small','start')}${details.length?text(x+42,y+88,details,'tiny','start',19):''}`}
function label(x,y,s,w=160){return `<rect x="${x-w/2}" y="${y-22}" width="${w}" height="32" fill="#fff"/>${text(x,y,s,'label')}`}
function flow(d,s,x,y,w=160){return `<path d="${d}" class="flow"/>${s?label(x,y,s,w):''}`}
const svg = `${start()}
${entity(70,520,260,150,'CANDIDATE',['starts session,','speaks answers'])}
${entity(70,910,260,150,'BROWSER / CDN',['camera, mic,','MediaPipe models'])}
${entity(1880,455,245,145,'GEMINI AI',['answer scoring','ideal answers'])}
${store(500,230,300,95,'D3','INTERVIEWS',['candidate, role, questions'])}
${proc(500,455,280,125,'4.1','LOAD SESSION',['validate id, load','question queue'])}
${proc(850,455,280,125,'4.2','MEDIA CAPTURE',['camera/mic stream,','timer, controls'])}
${proc(1200,455,280,125,'4.3','LANDMARKS',['face, pose, hand','landmarks'])}
${proc(1550,455,280,125,'4.4','BEHAVIOR CHECKS',['lighting, gaze, posture,','blink, gesture, movement'])}
${proc(850,740,280,125,'4.5','SPEECH CAPTURE',['transcript, WPM,','filler words'])}
${proc(1200,740,280,125,'5.1','ANSWER EVALUATION',['question + transcript,','score + feedback'])}
${proc(1550,740,280,125,'6.1','BUILD REPORT',['metrics, timeline,','snapshots'])}
${proc(1550,1010,280,125,'6.2','SAVE / VIEW',['dashboard, PDF,','history access'])}
${store(1880,1030,240,95,'D4','REPORTS',['metrics, report'])}
${flow('M330 570 L500 515','interview id',415,524,135)}
${flow('M640 325 L640 455','questions',670,392,115)}
${flow('M780 518 L850 518','session data',815,498,145)}
${flow('M1130 518 L1200 518','video frames',1165,498,135)}
${flow('M1480 518 L1550 518','landmarks',1515,498,115)}
${flow('M1690 580 L1690 740','behavior metrics',1725,665,170)}
${flow('M330 620 C535 720 705 805 850 805','spoken answer',610,750,155)}
${flow('M990 580 L990 740','audio stream',1020,665,135)}
${flow('M1130 805 L1200 805','transcript',1165,785,110)}
${flow('M1480 805 L1550 805','AI feedback',1515,785,125)}
${flow('M1480 785 L1525 785 L1525 520 L1880 520','prompt',1548,655,90)}
${flow('M1880 575 L1505 575 L1505 840 L1480 840','score',1700,590,80)}
${flow('M1690 865 L1690 1010','report payload',1730,942,155)}
${flow('M1830 1075 L1880 1075','save/read',1855,1055,110)}
${flow('M1550 1075 C1120 1200 655 1165 330 650','report/dashboard',950,1180,180)}
${flow('M330 975 C555 930 735 545 850 520','media access',600,900,135)}
${flow('M330 1000 C650 990 1045 555 1200 530','models',760,1012,90)}
${end()}`;
await fs.writeFile(path.join(outDir,'dfd-level-2-interview-report-flow.svg'), svg, 'utf8');
const browser = await chromium.launch({headless:true,args:['--disable-gpu']});
const page = await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
await page.goto('file:///' + path.resolve(path.join(outDir,'dfd-level-2-interview-report-flow.svg')).replace(/\\/g,'/'), {waitUntil:'load'});
await page.locator('svg').screenshot({path:path.join(outDir,'dfd-level-2-interview-report-flow.png'),timeout:120000});
await browser.close();
const stat = await fs.stat(path.join(outDir,'dfd-level-2-interview-report-flow.png'));
console.log(`dfd-level-2-interview-report-flow.png\t${stat.size}`);
