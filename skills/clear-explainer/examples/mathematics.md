# Mathematics example: the derivative of a square

This is a public, synthetic example. Use it to calibrate an explanation that needs
both intuition and a derivation, without confusing an example with a proof.

**Example request:** "What does the derivative of x squared mean?"

**Essence:** For the real-valued function f(x) = x², the derivative at x measures the
limiting rate at which the output changes per unit change in the input. It is 2x.

For a nonzero input change h, the average rate of change is

```text
[f(x + h) - f(x)] / h
= [(x + h)² - x²] / h
= (2xh + h²) / h
= 2x + h.
```

As h approaches 0, this rate approaches 2x. The division is valid for h ≠ 0; the
derivative uses the limit rather than substituting 0 into the original quotient.
At x = 3, the derivative is 6. For a small h, the output change is approximately
6h; its exact change is 6h + h².

**Analogy:** If input is time and output is position, the derivative plays the role
of instantaneous velocity.

**Limit:** Not every function describes motion, and not every function has a
derivative at every input. A measured velocity estimate over a finite interval is
not the mathematical limit itself.

**Optional recall prompt:** If h is 0.1 at x = 3, why is 6h an approximation to the
output change rather than the exact change? Wait for the learner's attempt before
giving the solution.
