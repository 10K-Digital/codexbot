export function connectionState(previous,{ok,status=0,now=Date.now()}) {
 if(ok)return {failures:0,since:null,phase:'connected'};
 const failures=(previous.failures||0)+1,since=previous.since??now;
 return {failures,since,phase:status===401||status===403?'unauthorized':failures>=3&&now-since>=15000?'offline':'reconnecting'};
}

export function attention(state,id,seen={}) {
 const unread=state.messages.filter(m=>(m.conversationId||m.agentId)===id&&m.role==='assistant'&&!m.streaming&&m.createdAt>(seen[id]||'')).length;
 const approvals=state.approvals.filter(r=>{const job=state.jobs.find(j=>j.id===r.jobId)||state.jobs.find(j=>j.agentId===r.agentId&&j.status==='waiting');return (job?.conversationId||r.conversationId||r.agentId)===id;}).length;
 return {unread,approvals,total:unread+approvals};
}
export function avatarSeed(id){let hash=2166136261;for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619);return hash>>>0;}
export function paintAvatar(node,id,working=false){
 const seed=avatarSeed(id);node.classList.add('character-avatar');node.classList.toggle('working',working);
 if(node.dataset.character===id)return;node.dataset.character=id;
 const colors=['#9bc7b1','#e7b975','#b7a9d8','#89bfcf','#e6a79d','#c4c982','#9fb5dd'];const color=colors[seed%colors.length];
 const shapes=['M10 22Q10 10 23 10H41Q54 10 54 23V43Q54 54 42 54H22Q10 54 10 42Z','M32 8C48 8 57 20 55 36S44 57 29 55 7 44 9 29 18 8 32 8Z','M20 10H44L57 32 45 54H19L7 32Z','M15 12Q32 4 49 12L55 42Q51 57 32 55 13 57 9 42Z','M11 24Q9 10 23 13L32 7 41 13Q55 10 53 24L57 37Q54 55 32 55 10 55 7 37Z'];
 const ns='http://www.w3.org/2000/svg',make=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const svg=make('svg',{viewBox:'0 0 64 64','aria-hidden':'true',class:'character-art'});svg.append(make('path',{d:shapes[(seed>>>4)%shapes.length],fill:color}));
 const face=make('g',{class:'character-face',fill:'none',stroke:'#243b35','stroke-width':'2.7','stroke-linecap':'round'});
 const expression=(seed>>>8)%4;
 if(expression===0){face.append(make('path',{d:'M19 28q4-5 8 0M37 28q4-5 8 0'}));}else{face.append(make('ellipse',{cx:23,cy:28,rx:2.3,ry:expression===1?4:3,fill:'#243b35',stroke:'none'}));face.append(expression===2?make('path',{d:'m37 28 7-2'}):make('ellipse',{cx:41,cy:28,rx:2.3,ry:3,fill:'#243b35',stroke:'none'}));}
 face.append(make('path',{d:['M24 38q8 9 16 0','M26 39q6 4 12-1','M25 38q8 8 15-1','M27 38h10q0 7-5 7t-5-7'][(seed>>>12)%4]}));
 if((seed>>>16)%3===0)face.append(make('path',{d:'M16 23h14v11H16ZM34 23h14v11H34ZM30 27h4','stroke-width':'1.5'}));
 svg.append(face);node.replaceChildren(svg);
}
