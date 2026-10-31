<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { defaultTransferDescription, findLatestRowByName, isTransfer } from '../lib/domain';
  import type { TransactionDraft, TransactionKind } from '../lib/types';
  import { addDaysToDate, formatDigitsWithThousands, keepDigits, todayIso } from '../lib/utils';

  /** `onSubmit` returns an error message to show, or an empty string when the draft was saved. */
  let {
    draft = $bindable(),
    mode,
    onSubmit,
    onDelete
  }: {
    draft: TransactionDraft;
    mode: 'new' | 'edit';
    onSubmit: (draft: TransactionDraft) => string;
    onDelete?: () => void;
  } = $props();

  const isEditing = $derived(mode === 'edit');
  const isTransferDraft = $derived(draft.kind === 'transfer');
  const kindOptions = $derived<[TransactionKind, string][]>([
    ['expense', 'Gasto'],
    ['income', 'Ingreso'],
    ...(isEditing ? [] : [['transfer', 'Traspaso'] as [TransactionKind, string]])
  ]);
  // New transactions cannot pick the transfer type: the Traspaso button covers that.
  const selectableTypes = $derived(isEditing ? app.data.types : app.data.types.filter((type) => !isTransfer(type)));
  const destinationAccounts = $derived(app.data.accounts.filter((account) => account !== draft.account));
  const descriptionPlaceholder = $derived(
    isTransferDraft
      ? draft.destinationAccount
        ? defaultTransferDescription(app.data.config, draft.destinationAccount)
        : 'Ej: Pago tarjeta'
      : ''
  );
  let errorMessage = $state('');

  function handleAmountInput(event: Event & { currentTarget: HTMLInputElement }) {
    draft.amountDigits = keepDigits(event.currentTarget.value);
    event.currentTarget.value = formatDigitsWithThousands(draft.amountDigits);
  }

  function chooseAccount(account: string) {
    draft.account = account;
    draft.hasChosenAccount = true;
    if (draft.destinationAccount === account) draft.destinationAccount = '';
  }

  function autofillFromPreviousTransaction() {
    if (mode !== 'new' || draft.kind === 'transfer') return;
    const previous = findLatestRowByName(app.data, draft.name);
    if (!previous) return;
    const [, , , previousDescription, , previousType, previousAccount] = previous;
    if (!draft.hasChosenType) draft.type = previousType;
    if (!draft.hasChosenAccount) draft.account = previousAccount;
    if (!draft.hasEditedDescription && !draft.description) draft.description = previousDescription;
  }

  function submit() {
    errorMessage = onSubmit(draft);
  }

  function submitOnEnter(event: KeyboardEvent) {
    const target = event.target as HTMLInputElement;
    if (event.key === 'Enter' && target.tagName === 'INPUT' && target.type !== 'date') {
      event.preventDefault();
      submit();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onkeydown={submitOnEnter} style="display:contents">
  <div class="seg" role="group" aria-label="Tipo de movimiento">
    {#each kindOptions as [kind, label] (kind)}
      <button type="button" class:on={draft.kind === kind} onclick={() => (draft.kind = kind)}>{label}</button>
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
      value={formatDigitsWithThousands(draft.amountDigits)}
      oninput={handleAmountInput}
    />
  </div>
  {#if !isTransferDraft}
    <div>
      <label class="f"
        >Comercio o nombre
        <input
          list="names"
          autocomplete="off"
          autocapitalize="sentences"
          bind:value={draft.name}
          onchange={autofillFromPreviousTransaction}
        />
      </label>
    </div>
  {/if}
  <label class="f"
    ><span>Descripción</span>
    <input
      autocomplete="off"
      autocapitalize="sentences"
      placeholder={descriptionPlaceholder}
      bind:value={draft.description}
      oninput={() => (draft.hasEditedDescription = true)}
    />
  </label>
  <div class="row">
    <label class="f">Fecha<input type="date" bind:value={draft.date} /></label>
    <div class="quick">
      <button type="button" onclick={() => (draft.date = todayIso())}>Hoy</button>
      <button type="button" onclick={() => (draft.date = addDaysToDate(todayIso(), -1))}>Ayer</button>
    </div>
  </div>
  {#if !isTransferDraft}
    <div>
      <label class="f"
        >Tipo
        <select
          value={selectableTypes.includes(draft.type) ? draft.type : ''}
          onchange={(event) => {
            draft.type = event.currentTarget.value;
            draft.hasChosenType = true;
          }}
        >
          <option value="">Elige un tipo…</option>
          {#each selectableTypes as type (type)}<option value={type}>{type}</option>{/each}
        </select>
      </label>
    </div>
  {/if}
  <div>
    <div class="lbl">{isTransferDraft ? 'Desde' : 'Cuenta'}</div>
    <div class="chips">
      {#each app.data.accounts as account (account)}
        <button type="button" class:on={account === draft.account} onclick={() => chooseAccount(account)}
          >{account}</button
        >
      {:else}
        <span class="muted small">Aún no hay opciones. Sincroniza para cargarlas desde tu planilla.</span>
      {/each}
    </div>
  </div>
  {#if isTransferDraft}
    <div>
      <div class="lbl">Destino</div>
      <div class="chips">
        {#each destinationAccounts as account (account)}
          <button
            type="button"
            class:on={account === draft.destinationAccount}
            onclick={() => (draft.destinationAccount = account)}>{account}</button
          >
        {:else}
          <span class="muted small">Aún no hay opciones. Sincroniza para cargarlas desde tu planilla.</span>
        {/each}
      </div>
    </div>
  {/if}
  <div class="err" role="alert">{errorMessage}</div>
  <button class="primary" type="button" onclick={submit}>{isEditing ? 'Guardar cambios' : 'Guardar'}</button>
  {#if isEditing}
    <button class="danger" type="button" onclick={onDelete}>Eliminar movimiento</button>
  {/if}
</div>
