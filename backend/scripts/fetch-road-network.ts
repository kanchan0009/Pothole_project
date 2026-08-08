/**
 * Fetches the Kathmandu valley road network from Overpass and writes it to
 * `backend/data/road-graph.json`, the offline cache the routing service reads.
 *
 * Overpass is queried over plain HTTP (HTTPS to Overpass/geofabrik is blocked
 * on this network; http://overpass-api.de works). The resulting graph is
 * committed, so runtime routing never touches the network again.
 *
 * Run:  npx tsx scripts/fetch-road-network.ts   (from backend/)
 */
import { fetchRoadNetwork, saveRoadGraph } from '../src/algorithms/roadGraph.js';

async function main(): Promise<void> {
  console.log('Fetching Kathmandu valley road network from Overpass (HTTP)...');
  const started = Date.now();
  const graph = await fetchRoadNetwork();
  await saveRoadGraph(graph);

  const edgeCount = graph.edges.reduce((n, e) => n + e.length, 0);
  console.log(
    `Done in ${((Date.now() - started) / 1000).toFixed(1)}s — ` +
      `${graph.nodes.length} nodes, ${edgeCount} edges, bbox ` +
      `${graph.bbox.minLat},${graph.bbox.minLng} → ${graph.bbox.maxLat},${graph.bbox.maxLng}`
  );
  console.log('Wrote backend/data/road-graph.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
