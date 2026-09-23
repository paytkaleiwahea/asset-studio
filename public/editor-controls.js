/* Asset Studio controls. Draft changes never trigger a render.
   Markup follows the shared control-rail primitives in app.css: one panel per
   group, a label and its live value on a single row, colors in a swatch grid. */
window.StudioControls = {
  validate(panel) {
    for (const input of panel.querySelectorAll('input,select,textarea')) {
      if (!input.reportValidity()) return false;
    }
    return true;
  },

  /* ---------- markup helpers ---------- */
  panelEl(title) {
    const section = document.createElement('section');
    section.className = 'rail-panel';
    const heading = document.createElement('h2');
    heading.textContent = title;
    section.append(heading);
    return section;
  },
  noteEl(text) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = text;
    return note;
  },
  fieldEl(text, forId) {
    const field = document.createElement('div');
    field.className = 'fld';
    const label = document.createElement('label');
    label.htmlFor = forId;
    const name = document.createElement('span');
    name.textContent = text;
    label.append(name);
    field.append(label);
    return { field, label };
  },

  mount(panel, variables, values, changed, upload, size) {
    const styleFields = variables.filter(v => v.type === 'color' || v.type === 'font');

    if (styleFields.length) {
      const section = this.panelEl('Style');
      const row = document.createElement('div'); row.className = 'rail-actions';
      const save = document.createElement('button'), apply = document.createElement('button');
      save.type = apply.type = 'button';
      save.className = apply.className = 'btn-sm';
      save.textContent = 'Save visual style'; apply.textContent = 'Apply saved style';
      const status = this.noteEl('');
      status.setAttribute('role', 'status');
      save.onclick = () => {
        try {
          localStorage.setItem('asset-studio:visual-style',
            JSON.stringify(Object.fromEntries(styleFields.map(v => [v.brandKey || v.id, values[v.id]]))));
          status.textContent = 'Style saved in this browser.';
        } catch { status.textContent = 'Browser storage is unavailable.'; }
      };
      apply.onclick = () => {
        try {
          const preset = JSON.parse(localStorage.getItem('asset-studio:visual-style') || 'null');
          if (!preset) { status.textContent = 'Save a style first.'; return; }
          for (const v of styleFields) {
            const value = preset[v.brandKey || v.id];
            if (typeof value === 'string' && (v.type !== 'color' || /^#[0-9a-f]{6}$/i.test(value))) values[v.id] = value;
          }
          changed();
          panel.textContent = '';
          this.mount(panel, variables, values, changed, upload, size);
        } catch { status.textContent = 'Could not read the saved style.'; }
      };
      row.append(save, apply);
      section.append(row, this.noteEl('Reuses the colors and fonts below across templates. Saved in this browser only.'), status);
      panel.append(section);
    }

    const groups = new Map();
    const swatches = new Map();
    const groupFor = v => v.group || (v.type === 'color' || v.type === 'font' ? 'Brand' : /background/i.test(v.id) ? 'Background' : 'Content');

    for (const v of variables) {
      const name = groupFor(v);
      if (!groups.has(name)) {
        const section = this.panelEl(name);
        panel.append(section);
        groups.set(name, section);
      }
      const section = groups.get(name);
      const inputId = 'var-' + v.id;

      /* Colors are dense enough to tile, so they get their own grid rather than
         one full-width row each. */
      if (v.type === 'color') {
        if (!swatches.has(section)) {
          const grid = document.createElement('div');
          grid.className = 'swatchgrid';
          section.append(grid);
          swatches.set(section, grid);
        }
        const cell = document.createElement('label');
        cell.className = 'swatch';
        cell.htmlFor = inputId;
        const caption = document.createElement('span');
        caption.textContent = v.label || v.id;
        const input = document.createElement('input');
        input.type = 'color';
        input.id = inputId;
        input.value = values[v.id] ?? '';
        input.oninput = () => { values[v.id] = input.value; changed(); };
        cell.append(caption, input);
        swatches.get(section).append(cell);
        continue;
      }

      const { field, label } = this.fieldEl(v.label || v.id, inputId);
      let input;

      if (v.type === 'enum' || v.type === 'font') {
        input = document.createElement('select');
        const options = v.options || ['Arial', 'Georgia', 'Verdana', 'Trebuchet MS', 'Courier New'].map(value => ({ value, label: value }));
        for (const o of options) input.add(new Option(o.label, o.value));
        if (!options.some(o => o.value === values[v.id])) input.add(new Option(String(values[v.id] || 'Inherit brand'), values[v.id] || ''));
      } else if (v.type === 'number' || v.type === 'boolean') {
        input = document.createElement('input');
        input.type = v.type === 'boolean' ? 'checkbox' : 'number';
        if (v.type === 'number') {
          input.step = v.step ?? 'any';
          if (v.min != null) input.min = v.min;
          if (v.max != null) input.max = v.max;
          input.required = true;
          input.className = 'num';
        } else {
          input.className = 'switch';
        }
      } else {
        input = document.createElement(
          v.multiline || String(v.default ?? '').length > 46 || /\n/.test(String(v.default ?? '')) ? 'textarea' : 'input');
      }

      input.id = inputId;
      if (input.tagName === 'INPUT' && !input.hasAttribute('type')) input.type = 'text';
      input.value = values[v.id] ?? '';
      input.checked = values[v.id] === true || values[v.id] === 'true';
      input.oninput = () => {
        values[v.id] = v.type === 'boolean' ? input.checked
          : v.type === 'number' && input.value !== '' ? Number(input.value)
          : input.value;
        changed();
      };

      /* A number or a toggle rides in the label row; everything else sits under it. */
      if (v.type === 'number' || v.type === 'boolean') label.append(input);
      else field.append(input);

      if (v.type === 'number' && v.min != null && v.max != null) {
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = v.min; slider.max = v.max; slider.step = v.step ?? 'any';
        slider.value = values[v.id] ?? v.default;
        slider.setAttribute('aria-label', (v.label || v.id) + ' slider');
        slider.oninput = () => { input.value = slider.value; input.oninput(); };
        input.addEventListener('input', () => { if (input.validity.valid) slider.value = input.value; });
        field.append(slider);
      }

      if (v.description) field.append(this.noteEl(v.description));

      if (v.type === 'string' && !v.multiline && /image|img|photo|logo|shot/i.test(v.id)) {
        const file = document.createElement('input');
        file.type = 'file'; file.accept = 'image/*';
        const tag = document.createElement('span');
        tag.className = 'setimg';
        tag.textContent = values[v.id] ? 'Image set' : '';
        file.setAttribute('aria-label', 'Upload ' + (v.label || v.id));
        file.onchange = async () => {
          if (file.files[0]) { await upload(v.id, file.files[0], tag); input.value = values[v.id] || ''; }
        };
        field.append(file, tag);
        if (/background/i.test(v.id)) this.background(field, v.id, values, upload, input, tag, size);
      }

      section.append(field);
    }
  },

  background(field, id, values, upload, input, tag, size) {
    const box = document.createElement('details');
    const title = document.createElement('summary');
    title.textContent = 'Create a reusable background';
    box.append(title);
    const style = document.createElement('select');
    for (const value of ['Gradient', 'Halo', 'Grid']) style.add(new Option(value, value));
    style.setAttribute('aria-label', 'Background style');
    const grid = document.createElement('div');
    grid.className = 'swatchgrid';
    const colors = [values.accentColor || '#2453ff', values.secondaryColor || '#5c7cff'].map((value, i) => {
      const cell = document.createElement('label');
      cell.className = 'swatch';
      const caption = document.createElement('span');
      caption.textContent = i ? 'Secondary' : 'Primary';
      const c = document.createElement('input');
      c.type = 'color'; c.value = value;
      c.setAttribute('aria-label', i ? 'Background secondary color' : 'Background primary color');
      cell.append(caption, c);
      grid.append(cell);
      return c;
    });
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'btn-sm'; button.textContent = 'Create background';
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = 'Creates a local SVG once. Save and preview to apply. No AI service or API key needed.';
    button.onclick = async () => {
      button.disabled = true;
      try {
        const svg = this.backgroundSvg(style.value, colors[0].value, colors[1].value, size.w, size.h);
        await upload(id, new File([svg], 'studio-background.svg', { type: 'image/svg+xml' }), tag);
        input.value = values[id] || '';
      } finally { button.disabled = false; }
    };
    box.append(style, grid, button, note);
    field.append(box);
  },

  backgroundSvg(style, a, b, w, h) {
    if (![a, b].every(c => /^#[0-9a-f]{6}$/i.test(c))) throw new Error('Invalid background colors');
    w = Math.max(1, Math.min(8192, Number(w) || 1080)); h = Math.max(1, Math.min(8192, Number(h) || 1080));
    const fill = style === 'Halo' ? 'radialGradient' : 'linearGradient';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><${fill} id="g"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></${fill}><pattern id="p" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="white" stroke-opacity=".16"/></pattern></defs><path fill="url(#g)" d="M0 0H${w}V${h}H0z"/>${style === 'Grid' ? `<path fill="url(#p)" d="M0 0H${w}V${h}H0z"/>` : ''}</svg>`;
  }
};
