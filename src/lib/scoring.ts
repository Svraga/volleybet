export function predictionPoints(predictedA: number, predictedB: number, resultA: number, resultB: number) {
  if (predictedA === resultA && predictedB === resultB) return 3
  return (predictedA > predictedB) === (resultA > resultB) ? 1 : 0
}
