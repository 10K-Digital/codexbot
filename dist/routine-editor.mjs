import {detectedTimezone,localDateInput,localToInstant} from './timezone.mjs';
import {cronToSchedule,scheduleToCron,describeSchedule,routineSchedule,describeRoutine,onceDate} from './schedule.mjs';
export function routineEditor(r,{el,button,t,save,timezone=detectedTimezone()}){
 const box=el('div',{class:'routine-editor'}),prompt=el('textarea',{rows:9},r.prompt),promptLabel=el('label',{},t('Instruções da rotina'));promptLabel.append(prompt);box.append(promptLabel);if(r.timezone&&r.timezone!==timezone)box.append(el('p',{class:'muted'},t('Agenda atual: {zone}. Ao alterar os horários, será usado {local}.',{zone:r.timezone,local:timezone})));
 const existing=routineSchedule(r),initial=existing||{kind:'weekly',days:[1,2,3,4,5],hours:[9],minute:0};let changed=false;
 const frequency=el('select'),fields=el('div',{class:'schedule-fields'}),summary=el('p',{class:'muted','aria-live':'polite'}),error=el('p',{role:'alert',class:'form-error'});
 for(const [value,label] of [['once','Uma única vez'],['weekly','Dias e horários'],['interval','A cada algumas horas'],['monthly','Mensal']])frequency.append(el('option',{value},t(label)));
 frequency.value=initial.kind;const label=el('label',{},t('Frequência'));label.append(frequency);box.append(label,fields,summary);
 let read;
 const update=()=>{try{summary.textContent=(read().kind==='once'?describeRoutine({schedule:read(),timezone},t):describeSchedule(scheduleToCron(read()),t))+' · '+t('Fuso horário: {zone}',{zone:timezone});error.textContent='';}catch(e){summary.textContent=t(e.message);}};
 function render(){
  fields.replaceChildren();const kind=frequency.value,controls={};
  const number=(key,title,value,min,max)=>{const input=el('input',{type:'number',min,max,value});const label=el('label',{},t(title));label.append(input);fields.append(label);controls[key]=input;};
  if(kind==='once'){
   const input=el('input',{type:'datetime-local',value:localDateInput(initial.at||Date.now()+3600000,timezone)}),label=el('label',{},t('Data e horário'));label.append(input);fields.append(label);
   read=()=>({kind:'once',at:localToInstant(input.value,timezone)});
   fields.oninput=()=>{changed=true;update();};update();return;
  }
  let days=[],hours=[];
  if(kind!=='monthly'){
   const group=el('fieldset'),legend=el('legend',{},t('Dias da semana'));group.append(legend);
   ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].forEach((name,i)=>{const check=el('input',{type:'checkbox'});check.checked=(initial.days||[1,2,3,4,5]).includes(i);const label=el('label',{class:'schedule-check'},t(name));label.prepend(check);group.append(label);days.push(check);});fields.append(group);
  }else number('day','Dia do mês',initial.day||1,1,31);
  if(kind==='interval'){number('every','A cada quantas horas?',initial.every||2,1,23);number('start','Hora inicial',initial.start??8,0,23);number('end','Hora final',initial.end??20,0,23);}
  else{
   const group=el('fieldset'),legend=el('legend',{},t('Horários'));group.append(legend);
   for(let i=0;i<24;i++){const check=el('input',{type:'checkbox'});check.checked=(initial.hours||[9]).includes(i);const label=el('label',{class:'schedule-check'},String(i).padStart(2,'0')+'h');label.prepend(check);group.append(label);hours.push(check);}fields.append(group);
  }
  number('minute','Minuto de cada hora selecionada',initial.minute,0,59);
  read=()=>({kind,minute:controls.minute.valueAsNumber,...(kind==='monthly'?{day:controls.day.valueAsNumber}:{days:days.flatMap((x,i)=>x.checked?[i]:[])}),...(kind==='interval'?{start:controls.start.valueAsNumber,end:controls.end.valueAsNumber,every:controls.every.valueAsNumber}:{hours:hours.flatMap((x,i)=>x.checked?[i]:[])})});
  fields.oninput=()=>{changed=true;update();};update();
 }
 frequency.onchange=()=>{changed=true;render();};render();
 if(!existing)summary.textContent=t('Agendamento personalizado preservado. Altere a frequência apenas se desejar substituí-lo.');
 box.append(el('p',{class:'muted'},t('Agendamentos únicos executam quando o Mac voltar a ficar disponível e são desativados após o disparo. Horários recorrentes perdidos com o Mac desligado não são recuperados. Dias 29–31 só executam nos meses que possuem esse dia. Pausar não interrompe tarefas em andamento.')),error);
 const submit=button(t('Salvar alterações'),async()=>{try{error.textContent='';const body={id:r.id,prompt:prompt.value};if(changed){body.timezone=timezone;body.schedule=read();if(body.schedule.kind==='once')onceDate(body.schedule.at,{future:true});else scheduleToCron(body.schedule);}submit.disabled=true;await save(body);}catch(e){error.textContent=t(e.message);}finally{submit.disabled=false;}},'primary');box.append(submit);return box;
}
