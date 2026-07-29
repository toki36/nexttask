package priority

import (
	"testing"
	"time"

	"nexttask/backend/internal/model"
)

func TestScoreUsesUrgencyAndImportance(t *testing.T) {
	now := time.Date(2026, time.July, 29, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		name      string
		task      model.Task
		wantScore float64
	}{
		{
			name: "low importance",
			task: model.Task{
				Deadline:         now.Add(2 * time.Hour),
				EstimatedMinutes: 60,
				Importance:       1,
				Status:           model.TaskStatusOpen,
			},
			wantScore: 40,
		},
		{
			name: "normal importance",
			task: model.Task{
				Deadline:         now.Add(2 * time.Hour),
				EstimatedMinutes: 60,
				Importance:       2,
				Status:           model.TaskStatusOpen,
			},
			wantScore: 50,
		},
		{
			name: "high importance",
			task: model.Task{
				Deadline:         now.Add(2 * time.Hour),
				EstimatedMinutes: 60,
				Importance:       3,
				Status:           model.TaskStatusOpen,
			},
			wantScore: 60,
		},
		{
			name: "urgency is capped",
			task: model.Task{
				Deadline:         now.Add(time.Hour),
				EstimatedMinutes: 120,
				Importance:       3,
				Status:           model.TaskStatusOpen,
			},
			wantScore: 100,
		},
		{
			name: "overdue",
			task: model.Task{
				Deadline:         now.Add(-time.Minute),
				EstimatedMinutes: 30,
				Importance:       1,
				Status:           model.TaskStatusOpen,
			},
			wantScore: 100,
		},
		{
			name: "completed",
			task: model.Task{
				Deadline:         now.Add(time.Hour),
				EstimatedMinutes: 60,
				Importance:       3,
				Status:           model.TaskStatusCompleted,
			},
			wantScore: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Score(tt.task, now); got != tt.wantScore {
				t.Fatalf("Score() = %.1f, want %.1f", got, tt.wantScore)
			}
		})
	}
}
