<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { defaultTransferDesc, isTransfer, lastByName } from '../lib/domain';
  import type { Form, FormKind } from '../lib/types';
  import { addDays, formatDigits, today } from '../lib/utils';

  /** Formulario compartido por Registrar y la hoja de edición. `onsubmit` devuelve un mensaje de error o ''. */
  let {
    form = $bindable(),
    mode,
    onsubmit,
    ondelete
  }: { form: Form; mode: 'new' | 'edit'; onsubmit: (f: Form) => string; ondelete?: () => void } = $props();

  const isEdit = $derived(mode === 'edit');
  const isTransferForm = $derived(form.kind === 'traspaso');
  const kinds = $derived<[FormKind, string][]>([
    ['gasto', 'Gasto'],
    ['ingreso', 'Ingreso'],
    ...(isEdit ? [] : [['traspaso', 'Traspaso'] as [FormKind, string]])
  ]);
  // Al registrar no se ofrece el tipo "traspaso" (para eso está el botón Traspaso del formulario).
  const types = $derived(isEdit ? app.data.types : app.data.types.filter((t) => !isTransfer(t)));
  const destinations = $derived(app.data.accounts.filter((a) => a !== form.acct));
  const descPlaceholder = $derived(
    isTransferForm ? (form.to ? defaultTransferDesc(app.data.config, form.to) : 'Ej: Pago tarjeta') : ''
  );
  let error = $state('');

  function onAmount(e: Event & { currentTarget: HTMLInputElement }) {
    const digits = e.currentTarget.value.replace(/\D/g, '').slice(0, 11);
    form.amount = digits;
    e.currentTarget.value = formatDigits(digits);
  }

  function pickAccount(a: string) {
    form.acct = a;
    form.acctTouched = true;
    if (form.to === a) form.to = '';
  }

  /** Al terminar de escribir un nombre conocido, sugiere lo que usaste la última vez. */
  function suggestFromName() {
    if (mode !== 'new' || form.kind === 'traspaso') return;
    const last = lastByName(app.data, form.name);
    if (!last) return;
    if (!form.typeTouched) form.type = last[5];
    if (!form.acctTouched) form.acct = last[6];
    if (!form.descTouched && !form.desc) form.desc = last[3];
  }

  function submit() {
    error = onsubmit(form);
  }

  // Enter en un campo = Guardar
  function onKey(e: KeyboardEvent) {
    const target = e.target as HTMLInputElement;
    if (e.key === 'Enter' && target.tagName === 'INPUT' && target.type !== 'date') {
      e.preventDefault();
      submit();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onkeydown={onKey} style="display:contents">
  <div class="seg" role="group" aria-label="Tipo de movimiento">
    {#each kinds as [k, label] (k)}
      <button type="button" class:on={form.kind === k} onclick={() => (form.kind = k)}>{label}</button>
    {/each}
  </div>
  <div class="amt-in">
    <span>$</span>
    <input
      id="f-amount"
      inputmode="numeric"
      autocomplete="off"
      placeholder="0"
      aria-label="Monto"
      value={formatDigits(form.amount)}
      oninput={onAmount}
    />
  </div>
  {#if !isTransferForm}
    <div>
      <label class="f"
        >Comercio o nombre
        <input
          id="f-name"
          list="names"
          autocomplete="off"
          autocapitalize="sentences"
          bind:value={form.name}
          onchange={suggestFromName}
        />
      </label>
    </div>
  {/if}
  <label class="f"
    ><span>Descripción</span>
    <input
      id="f-desc"
      autocomplete="off"
      autocapitalize="sentences"
      placeholder={descPlaceholder}
      bind:value={form.desc}
      oninput={() => (form.descTouched = true)}
    />
  </label>
  <div class="row">
    <label class="f">Fecha<input type="date" id="f-date" bind:value={form.date} /></label>
    <div class="quick">
      <button type="button" onclick={() => (form.date = today())}>Hoy</button>
      <button type="button" onclick={() => (form.date = addDays(today(), -1))}>Ayer</button>
    </div>
  </div>
  {#if !isTransferForm}
    <div>
      <label class="f"
        >Tipo
        <select
          id="f-type"
          value={types.includes(form.type) ? form.type : ''}
          onchange={(e) => {
            form.type = e.currentTarget.value;
            form.typeTouched = true;
          }}
        >
          <option value="">Elige un tipo…</option>
          {#each types as t (t)}<option value={t}>{t}</option>{/each}
        </select>
      </label>
    </div>
  {/if}
  <div>
    <div class="lbl">{isTransferForm ? 'Desde' : 'Cuenta'}</div>
    <div class="chips">
      {#each app.data.accounts as a (a)}
        <button type="button" class:on={a === form.acct} onclick={() => pickAccount(a)}>{a}</button>
      {:else}
        <span class="muted small">Aún no hay opciones. Sincroniza para cargarlas desde tu planilla.</span>
      {/each}
    </div>
  </div>
  {#if isTransferForm}
    <div>
      <div class="lbl">Destino</div>
      <div class="chips">
        {#each destinations as a (a)}
          <button type="button" class:on={a === form.to} onclick={() => (form.to = a)}>{a}</button>
        {:else}
          <span class="muted small">Aún no hay opciones. Sincroniza para cargarlas desde tu planilla.</span>
        {/each}
      </div>
    </div>
  {/if}
  <div class="err" role="alert">{error}</div>
  <button class="primary" type="button" onclick={submit}>{isEdit ? 'Guardar cambios' : 'Guardar'}</button>
  {#if isEdit}
    <button class="danger" type="button" onclick={ondelete}>Eliminar movimiento</button>
  {/if}
</div>
