import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";

const jsonResponse = (ok: boolean, body: unknown = {}) => ({
  ok,
  json: async () => body,
});

describe("Home", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the login form when not signed in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(false)));
    render(<Home />);
    expect(await screen.findByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText("Kanban Studio")).not.toBeInTheDocument();
  });

  it("shows the board when already signed in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(true, { username: "user" })));
    render(<Home />);
    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
  });

  it("signs in, then logs out back to the login form", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(false)) // /api/me
      .mockResolvedValueOnce(jsonResponse(true, { username: "user" })) // /api/login
      .mockResolvedValueOnce(jsonResponse(true)); // /api/logout
    vi.stubGlobal("fetch", fetchMock);
    render(<Home />);

    await userEvent.type(await screen.findByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(await screen.findByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/logout", { method: "POST" });
  });
});
