## MODIFIED Requirements

### Requirement: RFC and RAC

The system SHALL calculate RFC (Struggle Rate) as the total count of warm colors (Red, Orange, Yellow) divided by total recorded observations ($N_{\text{total}}$ including all $n$ probe steps), and RAC (Achievement Rate) as $1 - \text{RFC}$ (equivalent to cool colors Green, Blue, Indigo, Purple divided by $N_{\text{total}}$).

#### Scenario: One hundred finalized responses
- **WHEN** a window contains 27 Red-or-Yellow and 73 Green-or-Purple Final Results without probing
- **THEN** RFC is 27 percent and RAC is 73 percent

#### Scenario: Multi-step probe calculation
- **WHEN** a session has 49 initial questions and one question has 3 probe steps (yielding 4 recorded colors: Green, Blue, Blue, Indigo), resulting in $N_{\text{total}} = 52$
- **THEN** RFC and RAC denominators equal 52 and RAC counts all 4 cool colors from that question

## ADDED Requirements

### Requirement: Dynamic Color Weight Matrix and Question-Averaged CPD

The system SHALL support configurable color weights $x \in [0, 1]$ across all 7 colors and derive Question CPD as the average CPD of all recorded colors for that question multiplied by $\text{CVR} \times \text{CCI}$.

#### Scenario: Calculate question CPD with probe sequence
- **WHEN** a question has $\text{CVR} = 10$, $\text{CCI} = 6$ ($\text{Base CPD} = 60$) and recorded colors `['green', 'blue', 'blue', 'indigo']` with weights $[0.5, 0.667, 0.667, 0.833]$
- **THEN** Question CPD equals $60 \times \text{mean}(0.5, 0.667, 0.667, 0.833)$
