package common

import (
	"context"
)

type EventHandler func(ctx context.Context, event *Event)

type LogCallback func(msg string, err error, fields ...any)

// EventQueue is responsible for concurrently consuming events from the PriorityQueue
type EventQueue struct {
	queue *PriorityQueue
}

// NewEventQueue creates a worker pool instance
func NewEventQueue(capacity int) *EventQueue {
	return &EventQueue{
		queue: NewPriorityQueue(capacity),
	}
}

func (e *EventQueue) Produce(data any, priority int) (*Event, error) {
	event := &Event{Data: data, Priority: priority}
	err := e.queue.Push(event)
	return event, err
}
func (e *EventQueue) ProduceWithContext(ctx context.Context, data any, priority int) (*Event, error) {
	event := &Event{Data: data, Priority: priority}
	return event, e.queue.PushWithContext(ctx, event)
}

func (e *EventQueue) UpdatePriority(event *Event, newPriority int) error {
	return e.queue.UpdatePriority(event, newPriority)
}

func (e *EventQueue) ConsumeLoop(ctx context.Context, handle EventHandler, log LogCallback) {
	for {
		event, err := e.queue.PopWithContext(ctx)
		if err != nil {
			select {
			case <-ctx.Done():
				log("ctx canceled", err)
				return
			default:
				log("pop error", err)
				continue
			}
		}
		handle(ctx, event)
	}
}

func (e *EventQueue) Stop() {
	e.queue.Close()
}
