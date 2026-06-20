import styles from "./index.module.css";

interface Props {
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function AlertFeedFooter({ hasMore, loadingMore, onLoadMore }: Props) {
  if (!hasMore) return null;

  return (
    <div className={styles.footer}>
      <button
        type="button"
        className={styles.loadMore}
        onClick={() => onLoadMore()}
        disabled={loadingMore}
      >
        {loadingMore ? "Loading…" : "Load more"}
      </button>
    </div>
  );
}
