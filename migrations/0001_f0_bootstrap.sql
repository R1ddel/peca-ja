-- F0 bootstrap: sem DDL de domínio.
-- O runner cria schema_migrations; este arquivo só marca a fase F0 como aplicada
-- quando alguém rodar `npm run db:migrate` de propósito (não em deploy automático).
SELECT 1;
