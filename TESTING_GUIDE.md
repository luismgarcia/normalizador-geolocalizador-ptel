# FASE 1: Testing Guide - Critical Validation Improvements

This document provides test cases to verify the 3 critical validation improvements.

## Test Case 1: Auto-correction of Truncated Y Coordinates

### Test Data
Create a CSV file with these coordinates (Granada region):

```csv
nombre,X,Y
Ayuntamiento,436780,136578
Centro Salud,437495,137548
Colegio,436950,136890
```

### Expected Results
- ✅ All Y coordinates should be auto-corrected:
  - 136578 → 4136578
  - 137548 → 4137548
  - 136890 → 4136890
- ✅ Alert badge "🔧 Auto-corregida" should appear next to Y values
- ✅ Green alert banner at top: "Coordenadas Y truncadas corregidas automáticamente"
- ✅ Each coordinate should show alert: "✅ Y truncada corregida: 136578 → 4136578"
- ✅ Scores should be 90+ (high confidence after correction)

### How to Test
1. Upload the CSV file in Step 1
2. Check Step 2 validation results
3. Look for green badges next to Y coordinates in "Coordenadas Originales" tab
4. Verify global alert banner appears
5. Expand alert details to see correction message

---

## Test Case 2: UTF-8 Character Normalization

### Test Data
Create a CSV with corrupted UTF-8:

```csv
nombre,X,Y
Salobre�a Ayuntamiento,447495,4066548
Centro M�dico Garc�a,447500,4066550
C.E.I.P. Jos� Mart�nez,447505,4066555
Polic�a Local n.� 1,447510,4066560
```

### Expected Results
- ✅ All corrupted characters should be normalized:
  - Salobre�a → Salobreña
  - M�dico → Médico
  - Garc�a → García
  - Jos� → José
  - Mart�nez → Martínez
  - Polic�a → Policía
  - n.� → n.º
- ✅ Blue info banner: "Caracteres UTF-8 normalizados"
- ✅ Alert in details: "ℹ️ Caracteres UTF-8 normalizados"
- ✅ Normalized names should display correctly in tables

### How to Test
1. Create CSV with intentionally corrupted characters (use find/replace in text editor)
2. Upload file in Step 1
3. Check that names are rendered correctly in Step 2
4. Verify blue alert banner appears
5. Check "Coordenadas Originales" tab for normalized names

---

## Test Case 3: Geographic Outlier Detection

### Test Data
Create CSV with one outlier coordinate (far from others):

```csv
nombre,X,Y
Ayuntamiento,447495,4066548
Centro Salud,447500,4066550
Colegio,447505,4066555
Outlier Erróneo,521581,4185653
```

### Expected Results
- ✅ First 3 coordinates: Score 90+, no geographic alerts
- ✅ 4th coordinate (Outlier):
  - Red badge "🚨 Outlier" next to confidence level
  - Alert: "🚨 ERROR GEOGRÁFICO CRÍTICO: Elemento a X.Xkm del más cercano"
  - Score significantly reduced (likely <60)
  - Lower confidence classification
- ✅ Red alert banner: "Errores geográficos extremos detectados"
- ✅ Banner message: "1 elemento está a más de 20km de sus vecinos..."

### How to Test
1. Upload CSV with coordinates where one is 100+ km away
2. Check Step 2 validation results
3. Look for red outlier badge in "Coordenadas Validadas UTM30" tab
4. Verify red alert banner at top
5. Check that outlier has critical alert in expanded details
6. Verify score is penalized appropriately

---

## Test Case 4: Combined Issues

### Test Data
CSV with ALL three issues:

```csv
nombre,X,Y
Salobre�a Centro,447495,066548
Ayuntamiento M�laga,436780,136578
Polic�a Almer�a,447500,066550
Outlier Le�n,242000,4745000
```

### Expected Results
- ✅ Row 1: UTF-8 normalized (�→ñ), Y truncated fixed (066548→4066548)
- ✅ Row 2: UTF-8 normalized (�→á), Y truncated fixed (136578→4136578)
- ✅ Row 3: UTF-8 normalized (�→í), Y truncated fixed (066550→4066550)
- ✅ Row 4: UTF-8 normalized (�→ó), Geographic outlier (León is 500km from Andalucía)
- ✅ All 3 alert banners visible:
  - Green: "X coordenadas Y truncadas corregidas"
  - Blue: "X registros con caracteres UTF-8 normalizados"
  - Red: "1 elemento con error geográfico extremo"
- ✅ Multiple alert types visible in expanded row details

### How to Test
1. Upload this complex CSV
2. Verify all 3 global alert banners appear
3. Check each coordinate has appropriate badges
4. Expand rows to see combined alerts
5. Verify León coordinate has critical score reduction

---

## Verification Checklist

Use this checklist after implementing the improvements:

### Code Structure
- [ ] `coordinateFixers.ts` created with `autoFixTruncatedY` and `detectTruncationPattern`
- [ ] `textNormalizers.ts` created with `normalizeUTF8` and `hasCorruptedUTF8`
- [ ] `geographicValidators.ts` created with `validateGeographicCoherence`
- [ ] All utilities properly imported in `fileProcessor.ts`
- [ ] UTF-8 normalization applied BEFORE coordinate processing
- [ ] Truncation fix applied DURING coordinate normalization
- [ ] Geographic validation applied AFTER UTM30 conversion
- [ ] Types updated with new fields: `autoFixed`, `fixConfidence`, `hadUTF8Corruption`, `geographicValidation`

### UI Integration
- [ ] Step2 component shows 3 global alert banners
- [ ] DataTabs shows "🔧 Auto-corregida" badge next to fixed Y coordinates
- [ ] DataTabs shows "🚨 Outlier" badge for geographic outliers
- [ ] Alert expansion shows all combined alerts
- [ ] Scores properly adjusted for geographic issues
- [ ] Confidence levels reflect geographic validation

### PRD Documentation
- [ ] PRD updated with new features in Essential Features section
- [ ] Edge cases updated to document new handling
- [ ] Character normalization documented
- [ ] Truncation correction documented
- [ ] Geographic outlier detection documented

---

## Expected Performance

The improvements should:
- Process files with 1000+ coordinates in <2 seconds
- Apply all 3 validations without noticeable lag
- Maintain existing validation scores for valid data
- Only penalize scores when issues are detected
- Show clear visual feedback for all corrections

---

## Common Issues to Watch For

1. **False Positives on Truncation**: Ensure Y coordinates >300,000 are NOT flagged as truncated
2. **UTF-8 Over-normalization**: Valid special characters (like em-dash in addresses) should be preserved
3. **Single Coordinate Files**: Geographic validation should gracefully handle files with 1 coordinate
4. **Province Detection**: Truncation correction should work even without province column
5. **Score Balance**: Geographic outliers should still allow high scores if other validations pass

---

## Success Metrics

After implementation, test files should show:
- **Truncation**: 100% detection rate for Y values 100,000-300,000 with valid X
- **UTF-8**: 100% normalization of common Spanish characters (á, é, í, ó, ú, ñ)
- **Outliers**: 100% detection of coordinates >20km from nearest neighbor
- **UI Feedback**: All corrections visible in <200ms
- **No Regressions**: Existing valid coordinates maintain 90+ scores
