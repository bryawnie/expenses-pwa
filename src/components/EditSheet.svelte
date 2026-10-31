<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { originalOf } from '../lib/domain';
  import { buildEditItem, formFromRow } from '../lib/forms';
  import type { Row } from '../lib/types';
  import MovementForm from './MovementForm.svelte';

  let { row, onclose }: { row: Row; onclose: () => void } = $props();
  // svelte-ignore state_referenced_locally
  let form = $state(formFromRow(row)); // copia editable: la hoja se monta una vez por fila

  function submit(): string {
    const built = buildEditItem(form, row.id || '');
    if (built.error !== undefined) return built.error;

    if (row.pending) {
      // Aún no llegó a la planilla: basta con corregir el alta en la cola.
      app.replacePendingItem(built.value);
    } else {
      app.enqueue({ action: 'update', payload: { row: row.r, orig: originalOf(row), item: built.value } });
    }
    app.toast('Cambios guardados ✓');
    onclose();
    return '';
  }

  function remove() {
    if (!confirm('¿Eliminar este movimiento de tu planilla?')) return;
    if (row.pending) app.removePendingItem(row.id || '');
    else app.enqueue({ action: 'delete', payload: { row: row.r, orig: originalOf(row) } });
    app.toast('Eliminado');
    onclose();
  }
</script>

<svelte:window onkeydown={e => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div id="overlay" class="on" onclick={e => e.target === e.currentTarget && onclose()}>
  <div id="sheet" role="dialog" aria-modal="true">
    <div class="grab"></div>
    <div id="sheetBody"><MovementForm bind:form mode="edit" onsubmit={submit} ondelete={remove} /></div>
  </div>
</div>
