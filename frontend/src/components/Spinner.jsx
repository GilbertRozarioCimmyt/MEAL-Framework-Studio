/** Uses the original app.html `.spinner` class. */
export default function Spinner({ size = "sm", label = "Loading…" }) {
  return (
    <span
      className={`spinner${size === "lg" ? " lg" : ""}`}
      role="status"
      aria-label={label}
      style={size === "lg" ? undefined : { width: 14, height: 14 }}
    />
  );
}
