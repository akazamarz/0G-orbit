import { useState } from "react";
import styles from "./index.module.css";

interface Props {
  alertId: string;
}

export function FeedbackPill({ alertId }: Props) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);

  async function vote(value: "up" | "down") {
    setRating(value);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alertId, rating: value }),
    });
  }

  return (
    <div className={styles.group}>
      <button
        className={`${styles.btn} ${rating === "up" ? styles.active : ""}`}
        onClick={() => vote("up")}
        aria-label="good signal"
      >
        👍
      </button>
      <button
        className={`${styles.btn} ${rating === "down" ? styles.down : ""}`}
        onClick={() => vote("down")}
        aria-label="bad signal"
      >
        👎
      </button>
    </div>
  );
}
