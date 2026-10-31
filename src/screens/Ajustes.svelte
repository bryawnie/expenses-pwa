<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { accountConfig, isTransfer } from '../lib/domain';
  import type { AccountKind, Config } from '../lib/types';
  import { formatDigits } from '../lib/utils';

  let url = $state(app.settings.url);
  let token = $state(app.settings.token);
  let connMsg = $state('');

  // Copia editable de cuentas y presupuestos; se envía al tocar «Guardar».
  let accounts = $state<Record<string, { kind: AccountKind; closeDay: string; dueDay: string }>>({});
  let budgets = $state<Record<string, string>>({});

  const types = $derived(app.data.types.filter(t => !isTransfer(t)));

  // Se rellena cuando llegan cuentas/categorías nuevas sin pisar lo que ya se está editando.
  $effect(() => {
    for (const a of app.data.accounts) {
      if (accounts[a]) continue;
      const c = accountConfig(app.data.config, a);
      accounts[a] = { kind: c.kind, closeDay: c.closeDay ? String(c.closeDay) : '', dueDay: c.dueDay ? String(c.dueDay) : '' };
    }
    for (const t of app.data.types) {
      if (budgets[t] !== undefined) continue;
      const b = app.data.config.budgets[t];
      budgets[t] = b ? formatDigits(String(b)) : '';
    }
  });

  const message = $derived(
    connMsg || (app.err ? '⚠ ' + app.err : app.data.loaded ? `Conectado · ${app.data.rows.length} movimientos cargados.` : '')
  );
  const lastSyncText = $derived(
    app.lastSync ? new Date(app.lastSync).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'
  );

  async function saveConnection() {
    app.settings = { url: url.trim(), token: token.trim() };
    connMsg = 'Probando…';
    app.status = 'ok';
    await app.sync();
    connMsg = '';
    app.toast(app.err ? 'No se pudo conectar' : 'Conectado ✓');
  }

  const day = (v: string) => Math.min(31, +v.replace(/\D/g, '') || 0);

  function saveSettings() {
    const config: Config = JSON.parse(JSON.stringify(app.data.config));
    config.accounts = {};
    for (const [name, a] of Object.entries(accounts)) {
      if (!app.data.accounts.includes(name)) continue;
      const credit = a.kind === 'credito';
      config.accounts[name] = { kind: a.kind, closeDay: credit ? day(a.closeDay) : 0, dueDay: credit ? day(a.dueDay) : 0 };
    }
    config.budgets = {};
    for (const [type, v] of Object.entries(budgets)) {
      const amount = +v.replace(/\D/g, '');
      if (amount > 0) config.budgets[type] = amount;
    }
    app.saveConfig(config);
    app.toast('Guardado ✓');
  }

  function discard() {
    if (confirm('¿Descartar los cambios que aún no se envían a la planilla?')) app.discardQueue();
  }

  function clearLocal() {
    if (confirm('¿Borrar la copia local? Tu planilla no se toca.')) app.clearLocal();
  }
</script>

<div class="card">
  <h2>Conexión con tu planilla</h2>
  <label class="f">URL de la aplicación web (Apps Script)
    <input bind:value={url} placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off" autocapitalize="off" spellcheck="false" />
  </label>
  <label class="f">Token
    <input type="password" bind:value={token} autocomplete="off" autocapitalize="off" spellcheck="false" />
  </label>
  <button class="primary" style="margin-top:8px" onclick={saveConnection}>Guardar y probar conexión</button>
  <div class="muted small" style="margin-top:8px">{message}</div>
</div>

<div class="card">
  <h2>Cuentas</h2>
  {#each app.data.accounts as name (name)}
    {#if accounts[name]}
      <div class="cfgrow">
        <span class="nm">{name}</span>
        <select class="k" aria-label="Tipo de cuenta {name}" bind:value={accounts[name].kind}>
          <option value="debito">Débito / cuenta</option>
          <option value="credito">Tarjeta de crédito</option>
          <option value="efectivo">Efectivo</option>
        </select>
        {#if accounts[name].kind === 'credito'}
          <div class="sub">
            Cierre día <input class="day" inputmode="numeric" aria-label="Día de cierre" bind:value={accounts[name].closeDay} />
            Vence día <input class="day" inputmode="numeric" aria-label="Día de vencimiento" bind:value={accounts[name].dueDay} />
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <div class="muted small">Sincroniza para cargar tus cuentas.</div>
  {/each}
</div>

<div class="card">
  <h2>Presupuesto mensual por categoría</h2>
  {#each types as type (type)}
    <div class="cfgrow">
      <span class="nm">{type}</span>
      <input
        class="num bud"
        inputmode="numeric"
        placeholder="Sin límite"
        aria-label="Presupuesto {type}"
        value={budgets[type] ?? ''}
        oninput={e => { budgets[type] = e.currentTarget.value = formatDigits(e.currentTarget.value); }}
      />
    </div>
  {:else}
    <div class="muted small">Sincroniza para cargar tus categorías.</div>
  {/each}
  <button class="primary" onclick={saveSettings}>Guardar cuentas y presupuestos</button>
</div>

<div class="card">
  <h2>Sincronización</h2>
  <div class="line2"><span>Cambios pendientes</span><b>{app.queue.length}</b></div>
  <div class="line2"><span>Última sincronización</span><b>{lastSyncText}</b></div>
  <div style="display:flex;gap:8px;margin-top:8px">
    <button class="ghost" onclick={() => { app.status = 'ok'; void app.sync(); }}>Sincronizar ahora</button>
    {#if app.queue.length}<button class="ghost" onclick={discard}>Descartar pendientes</button>{/if}
  </div>
</div>

<div class="card">
  <h2>Este dispositivo</h2>
  <div class="muted small">Tus datos viven en tu planilla de Google. Aquí solo se guarda una copia para usar la app sin conexión.</div>
  <button class="ghost" style="margin-top:10px" onclick={clearLocal}>Borrar copia local</button>
</div>
