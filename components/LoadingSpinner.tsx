export default function LoadingSpinner({ small = false }: { small?: boolean }) {
  return <span className={`loading-spinner${small ? ' small' : ''}`} aria-hidden="true" />;
}
