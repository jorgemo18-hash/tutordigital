-- Ampliar modelo check para incluir Modelo 303 (IVA trimestral, sociedad),
-- Modelo 180 (resumen anual alquileres) y Modelo 390 (resumen anual IVA).
ALTER TABLE academia_fiscal_trimestres
  DROP CONSTRAINT IF EXISTS academia_fiscal_trimestres_modelo_check,
  ADD CONSTRAINT academia_fiscal_trimestres_modelo_check
    CHECK (modelo = ANY(ARRAY['130','202','115','111','303','180','390']));

-- Permitir trimestre = 0 para registros anuales (180, 390).
-- Los modelos trimestrales siguen usando 1-4.
ALTER TABLE academia_fiscal_trimestres
  DROP CONSTRAINT IF EXISTS academia_fiscal_trimestres_trimestre_check,
  ADD CONSTRAINT academia_fiscal_trimestres_trimestre_check
    CHECK (trimestre >= 0 AND trimestre <= 4);
