import {t} from './i18n.mjs';
export function cardHTML(html){const doc=new DOMParser().parseFromString(html,'text/html');for(const n of doc.querySelectorAll('script,iframe,object,embed,link,meta,base,form,input,textarea,button,select'))n.remove();for(const n of doc.querySelectorAll('*'))for(const a of [...n.attributes])if(a.name.startsWith('on')||['href','xlink:href','action','formaction','srcdoc'].includes(a.name))n.removeAttribute(a.name);html=doc.head.innerHTML+doc.body.innerHTML;return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"><style>body{font:15px system-ui;color:#243b35;margin:16px;overflow-wrap:anywhere}img,svg,table{max-width:100%}input,button,textarea,select{pointer-events:none}a{pointer-events:none}</style>${html}`;}
export function renderCard(card,{el,button,richText,submit}){
 const root=el('form',{class:'smart-card','aria-label':card.title}),fields=new Map();root.append(el('h3',{},card.title));
 const svg=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 for(const b of card.blocks){
 if(b.type==='text'){root.append(richText(b.text));continue;}
 if(['input','textarea','choice'].includes(b.type)){const section=el('fieldset',{class:'card-field'});section.append(el('legend',{},b.label+(b.required?' *':'')));const id='card-'+card.id+'-'+b.id;
 if(b.type==='choice'){const inputs=[];for(const option of b.options){const input=el('input',{type:b.multiple?'checkbox':'radio',name:id,value:option.value});input.checked=b.multiple?(card.response?.values[b.id]||[]).includes(option.value):card.response?.values[b.id]===option.value;const label=el('label',{class:'card-option'});label.append(input,el('span',{},option.label));section.append(label);inputs.push(input);}fields.set(b.id,()=>b.multiple?inputs.filter(i=>i.checked).map(i=>i.value):inputs.find(i=>i.checked)?.value||'');}
 else{const input=el(b.type==='input'?'input':'textarea',{id,'aria-label':b.label,placeholder:b.placeholder,maxlength:b.type==='input'?'2000':'32000',...(b.type==='textarea'?{rows:'6'}:{type:'text'})});input.value=card.response?.values[b.id]??b.value;input.required=b.required;section.append(input);fields.set(b.id,()=>input.value);}root.append(section);continue;}
 if(b.type==='table'){const wrap=el('div',{class:'card-table',tabindex:'0'}),table=el('table'),head=el('tr');for(const c of b.columns)head.append(el('th',{scope:'col'},c));const thead=el('thead');thead.append(head);table.append(thead);const body=el('tbody');for(const row of b.rows){const tr=el('tr');for(const cell of row)tr.append(el('td',{},cell));body.append(tr);}table.append(body);wrap.append(table);root.append(wrap);continue;}
 if(b.type==='chart'){const fig=el('figure',{class:'card-chart'});fig.append(el('figcaption',{},b.label));const chart=svg('svg',{viewBox:'0 0 600 230',role:'img','aria-label':b.label});const min=Math.min(0,...b.points.map(p=>p.value)),max=Math.max(1,...b.points.map(p=>p.value)),y=v=>180-(v-min)/(max-min)*150,step=540/Math.max(1,b.points.length),pts=[];chart.append(svg('line',{x1:30,y1:y(0),x2:570,y2:y(0),stroke:'currentColor',opacity:'.3'}));b.points.forEach((p,i)=>{const x=30+step*(i+.5);pts.push(x+','+y(p.value));if(b.kind==='bar')chart.append(svg('rect',{x:x-step*.32,y:Math.min(y(0),y(p.value)),width:step*.64,height:Math.max(1,Math.abs(y(p.value)-y(0))),rx:3,fill:'var(--accent)'}));else chart.append(svg('circle',{cx:x,cy:y(p.value),r:4,fill:'var(--accent)'}));});if(b.kind==='line')chart.append(svg('polyline',{points:pts.join(' '),fill:'none',stroke:'var(--accent)','stroke-width':3}));fig.append(chart);const legend=el('dl',{class:'chart-values'});for(const p of b.points){legend.append(el('dt',{},p.label),el('dd',{},String(p.value)));}fig.append(legend);root.append(fig);continue;}
 if(b.type==='diagram'){const box=el('figure',{class:'card-diagram'}),height=Math.max(110,Math.ceil(b.nodes.length/3)*110),drawing=svg('svg',{viewBox:`0 0 600 ${height}`,role:'img','aria-label':b.nodes.map(n=>n.label).join(' → ')}),position=new Map(b.nodes.map((n,i)=>[n.id,{x:10+(i%3)*200,y:10+Math.floor(i/3)*110}]));for(const e of b.edges){const from=position.get(e.from),to=position.get(e.to);drawing.append(svg('path',{d:`M${from.x+90} ${from.y+55} L${to.x+90} ${to.y+55}`,stroke:'var(--accent)','stroke-width':2,fill:'none'}));}for(const n of b.nodes){const {x,y}=position.get(n.id);drawing.append(svg('rect',{x,y,width:180,height:70,rx:10,fill:'var(--subtle)',stroke:'var(--border)'}));const label=svg('text',{x:x+90,y:y+40,'text-anchor':'middle',fill:'var(--fg)','font-size':14});label.textContent=n.label.length>22?n.label.slice(0,21)+'…':n.label;drawing.append(label);}box.append(drawing);const links=el('ul',{class:'diagram-connections'});for(const e of b.edges)links.append(el('li',{},b.nodes.find(n=>n.id===e.from).label+' → '+b.nodes.find(n=>n.id===e.to).label+(e.label?' · '+e.label:'')));box.append(links);root.append(box);continue;}
 if(b.type==='html'){root.append(el('iframe',{class:'card-html',title:card.title,sandbox:'',referrerpolicy:'no-referrer',srcdoc:cardHTML(b.html)}));}
 }
 const status=el('p',{class:'card-feedback',role:'status'}),actions=el('div',{class:'card-actions'});let sending=false;
 for(const a of card.actions){const btn=button(a.label,async()=>{if(sending||card.response)return;if(!root.reportValidity())return;const values=Object.fromEntries([...fields].map(([id,read])=>[id,read()]));for(const b of card.blocks)if(b.type==='choice'&&b.required&&(!values[b.id]||!values[b.id].length)){status.textContent=t('Preencha os campos obrigatórios.');return;}sending=true;for(const n of actions.querySelectorAll('button'))n.disabled=true;status.textContent=t('Enviando…');try{await submit({cardId:card.id,actionId:a.id,values});status.textContent=t('Resposta enviada.');for(const n of root.querySelectorAll('input,textarea,button'))n.disabled=true;}catch(e){status.textContent=t(e.message);for(const n of actions.querySelectorAll('button'))n.disabled=false;}finally{sending=false;}},'secondary');actions.append(btn);}
 if(card.actions.length)root.append(actions);root.append(status);root.onsubmit=e=>e.preventDefault();if(card.response){status.textContent=t('Resposta enviada.');for(const n of root.querySelectorAll('input,textarea,button'))n.disabled=true;}return root;
}

export function approvalPresentation(request){
 const p=request.params||{},auth=p._meta?._codex_apps?.connector_auth_failure;
 let args=p.arguments;try{if(typeof args==='string')args=JSON.parse(args);}catch{args=null;}
 const readable=value=>typeof value==='string'&&!/^[\s]*[\[{]/.test(value)?value.trim():'';
 const safeLink=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
 if(request.method==='mcpServer/elicitation/request'){
  if(p.mode==='url'||auth?.is_auth_failure)return {kind:'link',auth:!!auth?.is_auth_failure,name:readable(auth?.connector_name)||readable(p.serverName)||'Conector',url:safeLink(p.url)||safeLink(auth?.install_url),message:readable(p.message)};
  const schema=p.requestedSchema,properties=schema?.properties||{},fields=Object.entries(properties).map(([id,f])=>({...f,id}));
  const supported=schema?.type==='object'&&fields.length<=20&&fields.every(f=>!['$ref','anyOf','oneOf','allOf','not','pattern'].some(k=>k in f)&&['string','boolean','number','integer'].includes(f.type)&&(!f.enum||Array.isArray(f.enum)&&f.enum.every(x=>['string','number','boolean'].includes(typeof x))))&&(schema.required||[]).every(id=>Object.hasOwn(properties,id));
  return {kind:'form',message:readable(p.message),fields,required:schema?.required||[],supported};
 }
 if(request.method==='item/tool/requestUserInput')return {kind:'questions',questions:p.questions||[]};
 const parts=[readable(args?.details),readable(p.reason),readable(p.command)];
 for(const action of Array.isArray(p.commandActions)?p.commandActions:[])if(readable(action.command))parts.push(action.command);
 for(const [file,change] of Object.entries(p.changes||{})){parts.push(file);if(readable(change.diff))parts.push(change.diff);}
 if(p.permissions){for(const [key,value] of Object.entries(p.permissions)){if(key==='network'&&value?.enabled)parts.push(t('Acesso à rede'));if(key==='fileSystem'||key==='file_system'){for(const path of [...(value?.read||[]),...(value?.write||[])])if(typeof path==='string')parts.push(path);}}}
 return {kind:'approval',title:readable(args?.action)||t('Revisar ação do agente'),details:parts.filter(Boolean).join('\n\n')};
}
export function renderApproval(request,{el,button,submit}){
 const view=approvalPresentation(request),root=el('form',{class:'card approval'}),actions=el('div',{class:'actions'}),error=el('p',{class:'form-error',role:'alert'});let busy=false;
 root.onsubmit=event=>event.preventDefault();
 const send=async payload=>{if(busy)return;if(payload.approved!==false&&!root.reportValidity())return;busy=true;for(const b of actions.querySelectorAll('button'))b.disabled=true;try{await submit(payload);}catch(e){error.textContent=t('Não foi possível enviar sua resposta. Tente novamente.');}finally{busy=false;for(const b of actions.querySelectorAll('button'))b.disabled=false;}};
 const refuse=()=>button(t('Não continuar'),()=>send({approved:false}),'secondary');
 if(view.kind==='link'){
  root.append(el('h3',{},view.auth?t('Reconectar {name}',{name:view.name}):t('Concluir etapa no conector')),
   el('p',{},view.auth?t('O acesso ao {name} precisa ser reconectado. A tarefa está pausada até você concluir esta etapa.',{name:view.name}):view.message||t('O conector precisa que você conclua uma etapa na página dele.')),
   el('p',{},t('Abra o link abaixo, conclua a etapa e volte aqui. Depois, confirme para o agente tentar novamente.')));
  if(view.url){actions.append(el('a',{class:'primary',href:view.url,target:'_blank',rel:'noopener noreferrer'},view.auth?t('Reconectar {name}',{name:view.name}):t('Abrir página do conector')),button(t(view.auth?'Já reconectei — tentar novamente':'Já concluí — tentar novamente'),()=>send({approved:true}),'secondary'));}
  else root.append(el('p',{},t('O conector não forneceu um link válido. Abra o ChatGPT no Mac, reconecte o serviço em Configurações → Apps e execute a tarefa novamente.')));
  actions.append(refuse());
 }else if(view.kind==='form'){
  root.append(el('h3',{},t('O conector precisa de informações')),el('p',{},view.message||t('Preencha os campos abaixo para continuar a tarefa.')));
  const readers=[];
  if(view.supported){for(const f of view.fields){const label=el('label',{},f.title||f.description||f.id.replaceAll('_',' '));let input,read;
    if(f.enum){input=el('select');input.append(el('option',{value:''},t('Selecione uma opção')));f.enum.forEach((v,i)=>input.append(el('option',{value:String(i)},f.enumNames?.[i]||String(v))));read=()=>input.value===''?undefined:f.enum[Number(input.value)];}
    else if(f.type==='boolean'){input=el('input',{type:'checkbox'});read=()=>input.checked;}
    else{input=el('input',{type:f.type==='string'?(f.writeOnly?'password':f.format==='email'?'email':f.format==='uri'?'url':'text'):'number'});if(f.type==='integer')input.step='1';else if(f.type==='number')input.step='any';if(f.minimum!==undefined)input.min=f.minimum;if(f.maximum!==undefined)input.max=f.maximum;if(f.minLength!==undefined)input.minLength=f.minLength;if(f.maxLength!==undefined)input.maxLength=f.maxLength;read=()=>input.value===''?undefined:f.type==='string'?input.value:input.valueAsNumber;}
    input.required=view.required.includes(f.id)&&f.type!=='boolean';input.setAttribute('aria-label',f.title||f.description||f.id.replaceAll('_',' '));label.append(input);root.append(label);readers.push([f.id,read]);
   }
   actions.append(button(t('Enviar informações'),()=>send({approved:true,content:Object.fromEntries(readers.map(([id,read])=>[id,read()]).filter(([,value])=>value!==undefined))}),'primary'));
  }else root.append(el('p',{},t('Este pedido usa um formulário que ainda não pode ser exibido aqui. Não continue sem revisar: abra o Codex no Mac para concluir a solicitação ou recuse e peça outra forma de continuar.')));
  actions.append(refuse());
 }else if(view.kind==='questions'){
  root.append(el('h3',{},t('O agente precisa da sua resposta')));const inputs={};for(const q of view.questions){const label=el('label',{},q.question);const input=el('textarea',{rows:'2','aria-label':q.question,required:''});inputs[q.id]=input;label.append(input);root.append(label);}actions.append(button(t('Responder'),()=>send({answers:Object.fromEntries(Object.entries(inputs).map(([id,i])=>[id,i.value]))}),'primary'));
 }else{
  root.append(el('h3',{},view.title),el('p',{},t('Confira a ação abaixo. Ao aprovar, você autoriza o agente a executá-la.')));
  if(view.details){root.append(el('pre',{},view.details));actions.append(button(t('Aprovar esta ação'),()=>send({approved:true}),'primary'));}
  else root.append(el('p',{},t('O pedido não informa o que será executado. Recuse e peça ao agente que descreva a ação antes de solicitar aprovação.')));
  actions.append(refuse());
 }
 root.append(actions,error);return root;
}
