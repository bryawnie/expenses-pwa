<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { toOriginalRowPayload } from '../lib/domain';
  import { draftFromTransaction, validateEditedTransaction } from '../lib/forms';
  import type { Transaction } from '../lib/types';
  import TransactionForm from './TransactionForm.svelte';

  let { transaction, onClose }: { transaction: Transaction; onClose: () => void } = $props();
  // svelte-ignore state_referenced_locally
  let draft = $state(draftFromTransaction(transaction)); // the sheet is mounted once per transaction

  function saveChanges(): string {
    const validation = validateEditedTransaction(draft, transaction.id || '');
    if (validation.error !== undefined) return validation.error;

    if (transaction.isPending) {
      app.replaceQueuedItem(validation.value);
    } else {
      app.enqueueOperation({
        action: 'update',
        payload: { row: transaction.sheetRow, orig: toOriginalRowPayload(transaction), item: validation.value }
      });
    }
    app.showToast('Cambios guardados ✓');
    onClose();
    return '';
  }

  function deleteTransaction() {
    if (!confirm('¿Eliminar este movimiento de tu planilla?')) return;
    if (transaction.isPending) {
      app.removeQueuedItem(transaction.id || '');
    } else {
      app.enqueueOperation({
        action: 'delete',
        payload: { row: transaction.sheetRow, orig: toOriginalRowPayload(transaction) }
      });
    }
    app.showToast('Eliminado');
    onClose();
  }
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div id="overlay" class="on" onclick={(event) => event.target === event.currentTarget && onClose()}>
  <div id="sheet" role="dialog" aria-modal="true">
    <div class="grab"></div>
    <div id="sheetBody">
      <TransactionForm bind:draft mode="edit" onSubmit={saveChanges} onDelete={deleteTransaction} />
    </div>
  </div>
</div>
