package priority

import (
	"math"
	"time"

	"nexttask/backend/internal/model"
)

func Score(task model.Task, now time.Time) float64 {
	if task.Status == model.TaskStatusCompleted {
		return 0
	}

	minutesUntilDeadline := task.Deadline.Sub(now).Minutes()
	if minutesUntilDeadline <= 0 {
		return 100
	}

	estimatedMinutes := math.Max(float64(task.EstimatedMinutes), 1)
	availableHours := math.Max(minutesUntilDeadline/60, 0.25)
	urgency := math.Min(estimatedMinutes/(availableHours*60), 1)
	importance := math.Min(math.Max(float64(task.Importance-1)/2, 0), 1)

	score := urgency*80 + importance*20
	return math.Round(math.Min(score, 100)*10) / 10
}
