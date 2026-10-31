<script lang="ts">
  import { hueFromText, splitLeadingEmoji } from '../lib/utils';

  let { type }: { type: string } = $props();
  const label = $derived(splitLeadingEmoji(type));
</script>

<span class="ico" style="--h:{hueFromText(label.text)}">{label.emoji || (label.text[0] || '·').toUpperCase()}</span>
