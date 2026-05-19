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

	estimated := math.Max(float64(task.EstimatedMinutes), 1)
	availableHours := math.Max(minutesUntilDeadline/60, 0.25)
	urgency := estimated / (availableHours * 60)
	weight := math.Max(float64(task.Weight), 1) / 10

	score := (urgency*80 + weight*20) * 100
	return math.Round(math.Min(score, 100)*10) / 10
}
