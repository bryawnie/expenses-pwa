<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { isTransfer, viewRows } from '../lib/domain';
  import { buildNewItems } from '../lib/forms';
  import { dayMonth } from '../lib/utils';
  import Amount from '../components/Amount.svelte';
  import CategoryIcon from '../components/CategoryIcon.svelte';
  import MovementForm from '../components/MovementForm.svelte';

  const recent = $derived(
    viewRows(app.data, app.queue)
      .filter((r) => !isTransfer(r.t))
      .slice(0, 4)
  );

  /** Valida el formulario y encola el alta. Devuelve un mensaje de error, o '' si todo salió bien. */
  function submit(): string {
    const f = app.draft;
    const built = buildNewItems(f, app.data.types, app.data.config);
    if (built.error !== undefined) return built.error;

    app.last.acct = f.acct;
    app.enqueue({ action: 'add', payload: { items: built.value } });
    app.toast(f.kind === 'traspaso' ? 'Traspaso guardado ✓' : 'Guardado ✓');
    app.resetDraft();
    document.getElementById('f-amount')?.focus();
    return '';
  }
</script>

{#if !app.settings.url}
  <div class="banner">Aún no está conectada tu planilla. Ve a <b>Ajustes</b> y pega la URL y el token.</div>
{/if}
<div class="card"><MovementForm bind:form={app.draft} mode="new" onsubmit={submit} /></div>
{#if recent.length}
  <div class="card">
    <h2>Últimos registros</h2>
    {#each recent as r, i (r.id ?? `${r.r}-${i}`)}
      <div class="item" style="cursor:default">
        <CategoryIcon type={r.t} />
        <span class="mid"><b>{r.n || '—'}</b><small>{dayMonth(r.d)} · {r.c}</small></span>
        <Amount row={r} />
      </div>
    {/each}
  </div>
{/if}
