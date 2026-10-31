<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { getAccountConfig, isTransfer } from '../lib/domain';
  import type { AccountKind, Config } from '../lib/types';
  import { formatDigitsWithThousands } from '../lib/utils';

  const MAX_DAY_OF_MONTH = 31;

  interface AccountForm {
    kind: AccountKind;
    closeDay: string;
    dueDay: string;
  }

  let url = $state(app.settings.url);
  let token = $state(app.settings.token);
  let connectionStatus = $state('');
  let accountForms = $state<Record<string, AccountForm>>({});
  let budgetInputs = $state<Record<string, string>>({});

  const budgetableTypes = $derived(app.data.types.filter((type) => !isTransfer(type)));
  const connectionMessage = $derived(
    connectionStatus ||
      (app.errorMessage
        ? '⚠ ' + app.errorMessage
        : app.data.loaded
          ? `Conectado · ${app.data.rows.length} movimientos cargados.`
          : '')
  );
  const lastSyncText = $derived(
    app.lastSyncedAt
      ? new Date(app.lastSyncedAt).toLocaleTimeString('es-CL', {
          hour: '2-digit',
          minute: '2-digit'
        })
      : '—'
  );

  // Fills in newly loaded accounts and categories without overwriting what is being edited.
  $effect(() => {
    for (const account of app.data.accounts) {
      if (accountForms[account]) continue;
      const { kind, closeDay, dueDay } = getAccountConfig(app.data.config, account);
      accountForms[account] = {
        kind,
        closeDay: closeDay ? String(closeDay) : '',
        dueDay: dueDay ? String(dueDay) : ''
      };
    }
    for (const type of app.data.types) {
      if (budgetInputs[type] !== undefined) continue;
      const budget = app.data.config.budgets[type];
      budgetInputs[type] = budget ? formatDigitsWithThousands(String(budget)) : '';
    }
  });

  async function saveConnection() {
    app.settings = { url: url.trim(), token: token.trim() };
    connectionStatus = 'Probando…';
    app.syncStatus = 'ok';
    await app.synchronize();
    connectionStatus = '';
    app.showToast(app.errorMessage ? 'No se pudo conectar' : 'Conectado ✓');
  }

  const parseDayOfMonth = (text: string) => Math.min(MAX_DAY_OF_MONTH, +text.replace(/\D/g, '') || 0);

  function saveAccountsAndBudgets() {
    const config: Config = JSON.parse(JSON.stringify(app.data.config));

    config.accounts = {};
    for (const [account, form] of Object.entries(accountForms)) {
      if (!app.data.accounts.includes(account)) continue;
      const isCredit = form.kind === 'credito';
      config.accounts[account] = {
        kind: form.kind,
        closeDay: isCredit ? parseDayOfMonth(form.closeDay) : 0,
        dueDay: isCredit ? parseDayOfMonth(form.dueDay) : 0
      };
    }

    config.budgets = {};
    for (const [type, text] of Object.entries(budgetInputs)) {
      const budget = +text.replace(/\D/g, '');
      if (budget > 0) config.budgets[type] = budget;
    }

    app.saveConfig(config);
    app.showToast('Guardado ✓');
  }

  function retrySync() {
    app.syncStatus = 'ok';
    void app.synchronize();
  }

  function confirmDiscardPending() {
    if (confirm('¿Descartar los cambios que aún no se envían a la planilla?')) app.discardPendingOperations();
  }

  function confirmClearLocalCopy() {
    if (confirm('¿Borrar la copia local? Tu planilla no se toca.')) app.clearLocalCopy();
  }
</script>

<div class="card">
  <h2>Conexión con tu planilla</h2>
  <label class="f"
    >URL de la aplicación web (Apps Script)
    <input
      bind:value={url}
      placeholder="https://script.google.com/macros/s/…/exec"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
    />
  </label>
  <label class="f"
    >Token
    <input type="password" bind:value={token} autocomplete="off" autocapitalize="off" spellcheck="false" />
  </label>
  <button class="primary" style="margin-top:8px" onclick={saveConnection}>Guardar y probar conexión</button>
  <div class="muted small" style="margin-top:8px">{connectionMessage}</div>
</div>

<div class="card">
  <h2>Cuentas</h2>
  {#each app.data.accounts as account (account)}
    {#if accountForms[account]}
      <div class="cfgrow">
        <span class="nm">{account}</span>
        <select class="k" aria-label="Tipo de cuenta {account}" bind:value={accountForms[account].kind}>
          <option value="debito">Débito / cuenta</option>
          <option value="credito">Tarjeta de crédito</option>
          <option value="efectivo">Efectivo</option>
        </select>
        {#if accountForms[account].kind === 'credito'}
          <div class="sub">
            Cierre día <input
              class="day"
              inputmode="numeric"
              aria-label="Día de cierre"
              bind:value={accountForms[account].closeDay}
            />
            Vence día
            <input
              class="day"
              inputmode="numeric"
              aria-label="Día de vencimiento"
              bind:value={accountForms[account].dueDay}
            />
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
  {#each budgetableTypes as type (type)}
    <div class="cfgrow">
      <span class="nm">{type}</span>
      <input
        class="num bud"
        inputmode="numeric"
        placeholder="Sin límite"
        aria-label="Presupuesto {type}"
        value={budgetInputs[type] ?? ''}
        oninput={(event) => {
          budgetInputs[type] = event.currentTarget.value = formatDigitsWithThousands(event.currentTarget.value);
        }}
      />
    </div>
  {:else}
    <div class="muted small">Sincroniza para cargar tus categorías.</div>
  {/each}
  <button class="primary" onclick={saveAccountsAndBudgets}>Guardar cuentas y presupuestos</button>
</div>

<div class="card">
  <h2>Sincronización</h2>
  <div class="line2">
    <span>Cambios pendientes</span><b>{app.queue.length}</b>
  </div>
  <div class="line2">
    <span>Última sincronización</span><b>{lastSyncText}</b>
  </div>
  <div style="display:flex;gap:8px;margin-top:8px">
    <button class="ghost" onclick={retrySync}>Sincronizar ahora</button>
    {#if app.queue.length}<button class="ghost" onclick={confirmDiscardPending}>Descartar pendientes</button>{/if}
  </div>
</div>

<div class="card">
  <h2>Este dispositivo</h2>
  <div class="muted small">
    Tus datos viven en tu planilla de Google. Aquí solo se guarda una copia para usar la app sin conexión.
  </div>
  <button class="ghost" style="margin-top:10px" onclick={confirmClearLocalCopy}>Borrar copia local</button>
</div>
