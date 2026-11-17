#include <iomanip>
#include <iostream>

// Independent simulation-only reference for the accounting equation.
int main() {
    constexpr double opening = 19721.0, spending = 100.0, fees = 2.0;
    constexpr double repayments = 50.0, external_payment = 0.0, adjustment = 0.0;
    const double closing = opening + spending + fees - repayments - external_payment - adjustment;
    std::cout << std::fixed << std::setprecision(2) << closing << "\n";
    return closing == 19773.0 ? 0 : 1;
}

