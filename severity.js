/**
 * Calculate severity and priority based on trust score and issue type
 * This is explainable, rule-based logic suitable for interviews
 */

function calculateSeverityAndPriority({ trust_score, issue_type }) {
  // Base severity mapping by issue type (explainable weights)
  const severityMap = {
    fire: 95,        // Critical - immediate danger
    accident: 90,    // Critical - safety issue
    road_block: 80,  // High - blocks traffic
    water_leak: 70,  // High - infrastructure damage
    pothole: 60,     // Medium - road safety
    garbage: 50,     // Medium - public health
    other: 40        // Low - general
  };

  // Start with base severity
  let base_severity = severityMap[issue_type] || 40;

  // Adjust based on trust score (explainable logic)
  // Lower trust = lower severity (unverified reports get deprioritized)
  if (trust_score < 40) {
    // Very low trust - reduce severity significantly
    base_severity = Math.max(20, base_severity - 30);
  } else if (trust_score < 60) {
    // Low trust - moderate reduction
    base_severity = Math.max(30, base_severity - 15);
  } else if (trust_score < 80) {
    // Medium trust - slight reduction
    base_severity = Math.max(40, base_severity - 5);
  }
  // High trust (>= 80) - no reduction, use base severity

  // Clamp severity between 0-100
  base_severity = Math.max(0, Math.min(100, base_severity));

  // Determine priority based on final severity
  let priority;
  if (base_severity >= 85) {
    priority = "HIGH";
  } else if (base_severity >= 60) {
    priority = "MEDIUM";
  } else {
    priority = "LOW";
  }

  return {
    trust_score,
    base_severity,
    priority
  };
}

module.exports = { calculateSeverityAndPriority };
