/* Asset Studio controls. Draft changes never trigger a render. */
window.StudioControls = {
  validate(panel) {
    for (const input of panel.querySelectorAll('input,select,textarea')) {
      if (!input.reportValidity()) return false;
    }
    return true;
  },
  mount(panel, variables, values, changed, upload, size) {
    const presetRow = document.createElement('div'); presetRow.className='row';
    const save=document.createElement('button'), apply=document.createElement('button');
    save.type=apply.type='button'; save.className=apply.className='btn ghost';
    save.textContent='Save visual style'; apply.textContent='Apply saved style';
    const styleFields=variables.filter(v=>v.type==='color'||v.type==='font');
    const status=document.createElement('small'); status.setAttribute('role','status');
    save.onclick=()=>{try {localStorage.setItem('asset-studio:visual-style',JSON.stringify(Object.fromEntries(styleFields.map(v=>[v.brandKey||v.id,values[v.id]]))));status.textContent='Style saved in this browser.';}catch{status.textContent='Browser storage is unavailable.'}};
    apply.onclick=()=>{try {const preset=JSON.parse(localStorage.getItem('asset-studio:visual-style')||'null');if(!preset){status.textContent='Save a style first.';return;}for(const v of styleFields){const value=preset[v.brandKey||v.id];if(typeof value==='string' && (v.type!=='color'||/^#[0-9a-f]{6}$/i.test(value)))values[v.id]=value;}changed();panel.querySelectorAll('fieldset').forEach(el=>el.remove());presetRow.remove();status.remove();this.mount(panel,variables,values,changed,upload,size);}catch{status.textContent='Could not read the saved style.'}};
    if(styleFields.length){presetRow.append(save,apply);panel.append(presetRow,status);}
    const groups = new Map();
    const groupFor = v => v.group || (v.type === 'color' || v.type === 'font' ? 'Brand' : /background/i.test(v.id) ? 'Background' : 'Content');
    for (const v of variables) {
      const name = groupFor(v);
      if (!groups.has(name)) {
        const section = document.createElement('fieldset');
        section.style.cssText = 'border:1px solid var(--line);border-radius:12px;padding:16px;display:grid;gap:14px;min-width:0';
        const legend = document.createElement('legend'); legend.textContent = name;
        section.append(legend); panel.append(section); groups.set(name, section);
      }
      const field = document.createElement('div'); field.className = 'field';
      const label = document.createElement('label'); label.textContent = v.label || v.id;
      label.htmlFor = 'var-' + v.id; field.append(label);
      let input;
      if (v.type === 'enum' || v.type === 'font') {
        input = document.createElement('select');
        const options = v.options || ['Arial', 'Georgia', 'Verdana', 'Trebuchet MS', 'Courier New'].map(value => ({value,label:value}));
        for (const o of options) input.add(new Option(o.label, o.value));
        if (!options.some(o => o.value === values[v.id])) input.add(new Option(String(values[v.id] || 'Inherit brand'), values[v.id] || ''));
      } else if (v.type === 'number' || v.type === 'boolean' || v.type === 'color') {
        input = document.createElement('input'); input.type = v.type === 'boolean' ? 'checkbox' : v.type;
        if (v.type === 'number') {
          input.step = v.step ?? 'any'; if (v.min != null) input.min = v.min; if (v.max != null) input.max = v.max;
          input.required = true;
          input.style.cssText = 'width:100%;padding:10px;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:9px;box-sizing:border-box';
        }
      } else input = document.createElement(v.multiline || String(v.default ?? '').length > 46 || /\n/.test(String(v.default ?? '')) ? 'textarea' : 'input');
      input.id = 'var-' + v.id;
      if (input.tagName === 'INPUT' && !input.hasAttribute('type')) input.type = 'text';
      input.value = values[v.id] ?? ''; input.checked = values[v.id] === true || values[v.id] === 'true';
      input.oninput = () => {
        values[v.id] = v.type === 'boolean' ? input.checked : v.type === 'number' && input.value !== '' ? Number(input.value) : input.value;
        changed();
      };
      field.append(input);
      if(v.type==='number' && v.min!=null && v.max!=null){
        const slider=document.createElement('input');slider.type='range';slider.min=v.min;slider.max=v.max;slider.step=v.step??'any';slider.value=values[v.id]??v.default;slider.style.width='100%';slider.setAttribute('aria-label',(v.label||v.id)+' slider');
        slider.oninput=()=>{input.value=slider.value;input.oninput();};
        input.addEventListener('input',()=>{if(input.validity.valid)slider.value=input.value;});field.append(slider);
      }
      if (v.description) { const help = document.createElement('small'); help.textContent = v.description; field.append(help); }
      if (v.type === 'string' && !v.multiline && /image|img|photo|logo|shot/i.test(v.id)) {
        const file = document.createElement('input'); file.type = 'file'; file.style.maxWidth='100%'; file.accept = 'image/*';
        const tag = document.createElement('span'); tag.className = 'setimg'; tag.textContent = values[v.id] ? 'Image set' : '';
        file.setAttribute('aria-label', 'Upload ' + (v.label || v.id));
        file.onchange = async () => { if(file.files[0]) { await upload(v.id, file.files[0], tag); input.value = values[v.id] || ''; } };
        field.append(file,tag);
        if (/background/i.test(v.id)) this.background(field, v.id, values, upload, input, tag, size);
      }
      groups.get(name).append(field);
    }
  },
  background(field, id, values, upload, input, tag, size) {
    const box = document.createElement('details'); const title = document.createElement('summary'); title.textContent = 'Create a reusable background'; box.append(title);
    const style = document.createElement('select');
    for (const value of ['Gradient','Halo','Grid']) style.add(new Option(value,value));
    style.setAttribute('aria-label','Background style');
    const colors = [values.accentColor || '#2453ff', values.secondaryColor || '#5c7cff'].map((value,i) => {
      const c=document.createElement('input'); c.type='color'; c.value=value; c.setAttribute('aria-label',i ? 'Background secondary color' : 'Background primary color'); return c;
    });
    const button=document.createElement('button'); button.type='button'; button.className='btn ghost'; button.textContent='Create background';
    const note=document.createElement('small'); note.textContent='Creates a local SVG once. Save and preview to apply. No AI service or API key needed.';
    button.onclick=async()=>{
      button.disabled=true;
      try {
        const svg=this.backgroundSvg(style.value,colors[0].value,colors[1].value,size.w,size.h);
        await upload(id,new File([svg],'studio-background.svg',{type:'image/svg+xml'}),tag);
        input.value=values[id] || '';
      } finally { button.disabled=false; }
    };
    box.append(style,...colors,button,note); field.append(box);
  },
  backgroundSvg(style,a,b,w,h) {
    if (![a,b].every(c=>/^#[0-9a-f]{6}$/i.test(c))) throw new Error('Invalid background colors');
    w=Math.max(1,Math.min(8192,Number(w)||1080)); h=Math.max(1,Math.min(8192,Number(h)||1080));
    const fill=style==='Halo' ? 'radialGradient' : 'linearGradient';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><${fill} id="g"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></${fill}><pattern id="p" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="white" stroke-opacity=".16"/></pattern></defs><path fill="url(#g)" d="M0 0H${w}V${h}H0z"/>${style==='Grid'?`<path fill="url(#p)" d="M0 0H${w}V${h}H0z"/>`:''}</svg>`;
  }
};
