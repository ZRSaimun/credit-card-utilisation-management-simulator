"""Independent Python check for the assignment's supplied figures.
This script never connects to banks or moves money.
"""
from dataclasses import dataclass

@dataclass(frozen=True)
class Card:
    name: str
    limit: float
    balance: float

CARDS = [
    Card('Capital One A', 2250, 0), Card('Capital One B', 1000, 645),
    Card('Barclays Rewards', 300, 35), Card('Santander A', 3300, 2006),
    Card('Santander B', 6800, 4900), Card('Aqua A', 3450, 0),
    Card('M&S Bank', 5400, 4415), Card('NatWest', 4200, 3220),
    Card('Aqua B', 2700, 2100), Card('Amex Gold', 6400, 2400),
]

total_limit = sum(c.limit for c in CARDS)
opening_debt = sum(c.balance for c in CARDS)
target = total_limit * 0.50
assert total_limit == 35800
assert opening_debt == 19721
assert round(opening_debt / total_limit * 100, 2) == 55.09
assert opening_debt - target == 1821

def closing_debt(opening, spending, fees, repayments, external, adjustment):
    return opening + spending + fees - repayments - external - adjustment

assert closing_debt(19721, 0, 0, 0, 0, 0) == 19721
assert closing_debt(19721, 100, 2, 50, 0, 0) == 19773
print('PASS: supplied totals and accounting roll-forward are valid')

