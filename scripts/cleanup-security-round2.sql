-- Limpeza da rodada 2 (auditoria 08/11/2026)
-- NÃO EXECUTAR sem backup. Dry-run primeiro. Não apaga o motorista real
-- da_driver_1793815017612_tk9vse.
--
-- Schema real: platform_state.payload JSONB e fleet_state.payload JSONB
-- (não há tabela platform_users / fleet_drivers). Campos novos de reset
-- (tokenHash, usedAt, attempts) vivem em payload.passwordResets[].

-- ========== DRY-RUN (só leitura) ==========

-- Conta de teste da auditoria
SELECT jsonb_path_query(payload, '$.users[*] ? (@.email == "smith.qa.1794182688@example.com")')
FROM platform_state WHERE id = 1;

SELECT jsonb_path_query(payload, '$.users[*] ? (@.id == "usr_mw8i1r34_e4b97491")')
FROM platform_state WHERE id = 1;

-- Drivers probe
SELECT jsonb_object_keys(payload->'drivers') AS fleet_id
FROM fleet_state WHERE id = 1;

-- Loja Recheck
SELECT jsonb_path_query(payload, '$.shops[*] ? (@.name like_regex "recheck" flag "i")')
FROM platform_state WHERE id = 1;

-- ========== BACKUP ==========
-- CREATE TABLE platform_state_bak_20261108 AS TABLE platform_state;
-- CREATE TABLE fleet_state_bak_20261108 AS TABLE fleet_state;

-- ========== APPLY (depois do backup; revisão humana) ==========
-- BEGIN;
--
-- -- Remove usuário de teste + sessões + resets
-- UPDATE platform_state SET
--   payload = jsonb_set(
--     jsonb_set(
--       jsonb_set(
--         payload,
--         '{users}',
--         COALESCE((
--           SELECT jsonb_agg(u)
--           FROM jsonb_array_elements(payload->'users') u
--           WHERE u->>'email' <> 'smith.qa.1794182688@example.com'
--             AND u->>'id' <> 'usr_mw8i1r34_e4b97491'
--         ), '[]'::jsonb)
--       ),
--       '{sessions}',
--       COALESCE((
--         SELECT jsonb_agg(s)
--         FROM jsonb_array_elements(payload->'sessions') s
--         WHERE s->>'userId' <> 'usr_mw8i1r34_e4b97491'
--       ), '[]'::jsonb)
--     ),
--     '{passwordResets}',
--     COALESCE((
--       SELECT jsonb_agg(r)
--       FROM jsonb_array_elements(COALESCE(payload->'passwordResets', '[]'::jsonb)) r
--       WHERE r->>'email' <> 'smith.qa.1794182688@example.com'
--     ), '[]'::jsonb)
--   ),
--   updated_at = NOW()
-- WHERE id = 1;
--
-- -- Remove loja Recheck
-- UPDATE platform_state SET
--   payload = jsonb_set(
--     payload,
--     '{shops}',
--     COALESCE((
--       SELECT jsonb_agg(s)
--       FROM jsonb_array_elements(payload->'shops') s
--       WHERE COALESCE(s->>'name','') !~* 'recheck'
--     ), '[]'::jsonb)
--   ),
--   updated_at = NOW()
-- WHERE id = 1;
--
-- -- Remove drivers probe (NÃO toca da_driver_1793815017612_tk9vse)
-- UPDATE fleet_state SET
--   payload = jsonb_set(
--     payload,
--     '{drivers}',
--     (payload->'drivers')
--       - 'sm-qa-probe'
--       - 'sm-qa-nonexistent-fleet'
--       - 'SMITH-TEST-001'
--       - 'probe-2'
--       - 'state-check'
--   ),
--   updated_at = NOW()
-- WHERE id = 1;
--
-- -- Revoga todos os sessionToken de motorista (força driver_auth de novo)
-- -- UPDATE fleet_state SET payload = jsonb_set(
-- --   payload, '{drivers}', (
-- --     SELECT COALESCE(jsonb_object_agg(key, value - 'sessionToken' || jsonb_build_object('online', false)), '{}'::jsonb)
-- --     FROM jsonb_each(payload->'drivers')
-- --   )
-- -- ) WHERE id = 1;
--
-- COMMIT;
--
-- ========== ROLLBACK ==========
-- TRUNCATE platform_state;
-- INSERT INTO platform_state SELECT * FROM platform_state_bak_20261108;
-- TRUNCATE fleet_state;
-- INSERT INTO fleet_state SELECT * FROM fleet_state_bak_20261108;
