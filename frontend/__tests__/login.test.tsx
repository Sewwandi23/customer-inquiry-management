
import {
  render,
  screen,
  fireEvent,
  cleanup,
} from "@testing-library/react";

import {
  afterEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";

import Home from "../app/page";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Login Page", () => {
  it("should display the login form", () => {
    render(<Home />);

    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it("should display an error when login credentials are invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          message: "Invalid email or password",
        }),
      })
    );

    render(<Home />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "wrong@example.com" },
    });

    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrongpassword" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /sign in/i })
    );

    expect(
      await screen.findByText("Invalid email or password")
    ).toBeInTheDocument();

    expect(mockPush).not.toHaveBeenCalled();
  });
});
