/**
 * Injeta projeção Ano 2 (escala nacional) no platform_state + fleet_state.
 * Preserva usuários reais, sessões e equipe HQ.
 *
 * Uso: npx tsx scripts/seed-hq-projection.ts
 */
import 'dotenv/config';
import { loadPlatformState, savePlatformState } from '../services/platformStore';
import { loadFleetState, saveFleetState } from '../services/fleetStore';
import {
  mergeProjectionIntoFleet,
  mergeProjectionIntoPlatform,
} from '../services/hqProjectionSeed';
import { HQ_YEAR2 } from '../services/hqProjection';

async function main() {
  console.log('→ Carregando platform_state…');
  const platform = await loadPlatformState();
  const { state, stats } = mergeProjectionIntoPlatform(platform);
  await savePlatformState(state);
  console.log('✓ Platform seed OK', stats);

  console.log('→ Carregando fleet_state…');
  const fleet = await loadFleetState();
  const nextFleet = mergeProjectionIntoFleet(fleet);
  await saveFleetState(nextFleet);
  console.log('✓ Fleet seed OK · drivers online sample', Object.keys(nextFleet.drivers).length);

  console.log('\nProjeção ativa:', HQ_YEAR2.label);
  console.log('  GMV mês:', HQ_YEAR2.month30d.gmv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  console.log('  Pedidos hoje:', HQ_YEAR2.today.count.toLocaleString('pt-BR'));
  console.log('  Lojas ativas:', HQ_YEAR2.shopsActive.toLocaleString('pt-BR'));
  console.log('  Clientes:', HQ_YEAR2.usersTotal.toLocaleString('pt-BR'));
  console.log('  Cidades ativas:', HQ_YEAR2.citiesActive);
  console.log('\nRecarregue /admin no navegador.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
