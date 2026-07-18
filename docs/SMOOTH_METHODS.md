# Smooth method capabilities

Core `geomSmooth` and `stat_smooth` support the serializable formula `y~x` with
three explicit methods:

- `lm`: ordinary least squares with an analytic confidence band.
- `loess`: one-dimensional degree-two local regression with tricube weights,
  `span`, robust iterations, and local covariance bands.
- `glm`: binomial responses with the logit link, fitted by deterministic IRLS
  with link-scale covariance transformed to probabilities.

The core does not silently select a method and does not implement GAM. A GAM
implementation must be a versioned extension-registry package whose portable
definition declares its input mappings and serializable model parameters and
whose Live and emitted adapters consume the same compiled product. This keeps
model runtimes and formula languages outside the stable core contract until a
specific backend is selected and conformance-tested.
