<script lang="ts">
  import { hue, splitEmoji } from '../lib/utils';

  let { type }: { type: string } = $props();
  const parts = $derived(splitEmoji(type));
</script>

<span class="ico" style="--h:{hue(parts.txt)}">{parts.e || (parts.txt[0] || '·').toUpperCase()}</span>
