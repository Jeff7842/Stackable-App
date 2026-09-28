import styles from "./checkbox.module.css";

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "className">;

// Controlled by the parent: <Checkbox id="remember" checked={remember} onChange={...} />.
// A CSS module (not styled-components) so the styles are in the server-rendered HTML - no flash.
export default function Checkbox(props: CheckboxProps) {
  return <input type="checkbox" className={styles.checkbox} {...props} />;
}
