<script setup lang="ts">
const cockpit=useCockpit();const error=ref('');
const runs=computed(()=>cockpit.items.value.runs.filter(r=>r.value.station!=='mining'));
async function refresh(){try{await cockpit.refresh('runs');error.value='';}catch{error.value='Shared work history is unavailable.';}}
function link(run:typeof runs.value[number]){if(run.value.station==='loop')return {query:{delivery:run.id}};return {query:{station:String(run.value.station),run:run.id,operationId:run.value.operationId as string|undefined,deliveryId:run.value.deliveryId as string|undefined,execution:run.value.execution as string|undefined,rootAgent:run.value.rootAgent as string|undefined}};}
onMounted(refresh);
</script>
<template><section class="panel" style="padding:24px;margin-top:24px"><div class="panel-heading"><h2>Recent work</h2><UButton variant="ghost" @click="refresh">Refresh</UButton></div><p v-if="error" role="status">{{error}}</p><p v-if="!runs.length" class="muted">Accepted worker and review runs appear here.</p><ul><li v-for="run in runs" :key="run.id"><NuxtLink :to="link(run)">{{run.value.label}} · {{run.value.station}}</NuxtLink></li></ul></section></template>
