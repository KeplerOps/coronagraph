import { mock } from "bun:test";

/**
 * A configurable fake for the Anthropic messages.create API.
 *
 * Default response returns a simple text message.
 * Override via setResponse() or by replacing messages.create directly.
 */
export class FakeAnthropic {
  public apiKey: string;
  public messages: {
    create: (params: unknown) => Promise<unknown>;
  };

  private _response: unknown;

  constructor(opts?: { apiKey?: string }) {
    this.apiKey = opts?.apiKey ?? "test-key";
    this._response = {
      id: "msg_test_123",
      type: "message",
      role: "assistant",
      content: [
        {
          type: "text",
          text: "This is a test response from the mock Anthropic client.",
        },
      ],
      model: "claude-sonnet-4-20250514",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
    };

    this.messages = {
      create: async (_params: unknown) => this._response,
    };
  }

  /**
   * Set the response that messages.create will return.
   */
  setResponse(response: unknown): void {
    this._response = response;
  }

  /**
   * Restore the default messages.create function (undoes any direct overrides).
   */
  resetCreate(): void {
    this.messages.create = async (_params: unknown) => this._response;
  }

  /**
   * Set the response to return a specific text content.
   */
  setTextResponse(text: string): void {
    this._response = {
      id: "msg_test_123",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text }],
      model: "claude-sonnet-4-20250514",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 50 },
    };
  }
}

/**
 * Set up a mock.module override for "@anthropic-ai/sdk" so that
 * `import Anthropic from "@anthropic-ai/sdk"` returns FakeAnthropic.
 *
 * Returns the FakeAnthropic instance so tests can configure responses.
 *
 * The MockAnthropic constructor shares the SAME `messages` object reference
 * from the FakeAnthropic instance, so calling `resetCreate()` or
 * `setResponse()` on the instance affects all already-constructed clients.
 *
 * Usage:
 *   const anthropic = setupAnthropicMock();
 *   anthropic.setTextResponse("custom response");
 */
export function setupAnthropicMock(): FakeAnthropic {
  const instance = new FakeAnthropic();

  mock.module("@anthropic-ai/sdk", () => ({
    default: class MockAnthropic {
      apiKey: string;
      messages: typeof instance.messages;
      constructor(opts?: { apiKey?: string }) {
        this.apiKey = opts?.apiKey ?? "test-key";
        // Share the same messages object so mutations are visible everywhere
        this.messages = instance.messages;
      }
    },
  }));

  return instance;
}
