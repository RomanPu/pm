import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";
import { initialData } from "@/lib/kanban";

// Mock backend: signed-in state toggled by /api/login and /api/logout
const mockApi = (signedIn: boolean) => {
  let session = signedIn;
  const fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/me") {
      return { ok: session, json: async () => ({ username: "user" }) };
    }
    if (url === "/api/login") {
      session = true;
      return { ok: true, json: async () => ({ username: "user" }) };
    }
    if (url === "/api/logout") {
      session = false;
      return { ok: true, json: async () => ({}) };
    }
    return { ok: session, json: async () => structuredClone(initialData) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

describe("Home", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the login form when not signed in", async () => {
    mockApi(false);
    render(<Home />);
    expect(await screen.findByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText("Kanban Studio")).not.toBeInTheDocument();
  });

  it("shows the board when already signed in", async () => {
    mockApi(true);
    render(<Home />);
    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
    expect(screen.getByText("Align roadmap themes")).toBeInTheDocument();
  });

  it("signs in, then logs out back to the login form", async () => {
    const fetchMock = mockApi(false);
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
