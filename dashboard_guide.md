# GridLock Dashboard Guide

This guide explains every part of the web dashboard in simple, plain language. The dashboard is designed to help policymakers see the difference between **what is currently happening** and **what should be happening** with parking enforcement.

---

## 1. Top Bar: The Big Numbers
At the very top right, you'll see three numbers summarizing the whole city:
*   **Total Records (298,450):** The total number of parking violations we analyzed over 7 months.
*   **Zones Tracked (54):** The number of different police station zones covering the city.
*   **Ignored High-Impact (12,279):** The most critical number. These are violations that caused severe traffic jams (high impact) but were historically ignored or rejected by the system (low escalation propensity). **These are the exact violations the city is missing.**

---

## 2. The Maps: Left vs. Right
The centerpiece of the dashboard is the two maps side-by-side. When you drag or zoom one, the other moves with it so you can compare the exact same streets.

> [!TIP]
> The gap between these two maps is the entire argument of this project.

### LEFT MAP: Violation Density (Raw Count)
*   **What it is:** A traditional heatmap showing where the most tickets are currently issued.
*   **What it means:** This shows the status quo. If a spot is bright red here, it just means police wrote a lot of tickets there. It **does not** mean those tickets actually helped traffic.

### RIGHT MAP: Operational Priority
*   **What it is:** A heatmap showing where enforcement *should* happen, combined with interactive circles for specific hotspots.
*   **What it means:** This map multiplies a violation's **Congestion Impact** (how badly it blocks traffic) by the system's **Escalation Propensity** (how likely the system is to ignore it).
*   **How to read it:** A bright red circle here means *"This area has violations that cause massive traffic jams, but your officers are currently ignoring them."* 

---

## 3. The Sidebar (Left Column)

### Key Finding
A summary of the core insight: The current system focuses on raw ticket counts rather than traffic impact, leading officers to patrol the "wrong" places (places that are easy to ticket, but don't cause traffic).

### Filters (Hour of Day)
*   You can drag the slider to see how the maps change throughout the day. For example, slide it to `09:00` to see the morning rush hour. 

### Model Explainability (SHAP)
*   **What it is:** A bar chart showing *how* the AI model makes its decisions.
*   **What it means:** It proves that the current enforcement system prioritizes **Time of Day** (the top red bar) over **Junction Proximity** (the bottom bar). Officers are ticketing based on their shift schedules, not based on whether a car is blocking a critical intersection. 

### Violation Distribution
*   A line graph showing when violations happen. 
*   **Blue line:** Total number of tickets written.
*   **Orange line:** The actual traffic priority of those tickets.

---

## 4. Top 10 Re-Ranked Zones (Bottom Table)
This table is the "scorecard" for the city's police zones. It proves mathematically that enforcement is misplaced.

*   **Count Rank:** Where the zone ranks if you just count the number of tickets written (Old System).
*   **Priority Rank:** Where the zone *should* rank based on actual traffic impact (New System).
*   **Rank Change:** The most important column.
    *   <span style="color:red">**▼ DOWN (Red):**</span> These zones drop in rank. Example: HSR Layout. They write a lot of tickets (Rank 15), but those tickets don't actually impact traffic (Priority Rank 29). **They are over-patrolled.**
    *   <span style="color:green">**▲ UP (Green):**</span> These zones jump in rank. Example: Cubbon Park. They don't write many tickets (Rank 28), but the few violations there cause massive traffic jams (Priority Rank 17). **They are severely under-patrolled.**
*   **Junction %:** Notice how the zones jumping UP (Green) have high junction percentages (85%), while zones dropping DOWN (Red) have 0% junctions. Officers are avoiding complex intersections where enforcement is needed most.
