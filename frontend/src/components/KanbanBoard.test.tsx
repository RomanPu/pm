import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData, type BoardData } from "@/lib/kanban";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

// Mock API: GET /api/board returns initialData, PUT records the saved board,
// POST /api/chat returns chatBoard as an AI update
const mockApi = ({ saveOk = true, loadOk = true, chatBoard = initialData } = {}) => {
  const saved: BoardData[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/chat") {
      return {
        ok: true,
        json: async () => ({ reply: "Done.", board_updated: true, board: chatBoard }),
      };
    }
    if (init?.method === "PUT") {
      saved.push(JSON.parse(init.body as string));
      return { ok: saveOk, json: async () => ({}) };
    }
    return { ok: loadOk, json: async () => structuredClone(initialData) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, saved, lastSaved: () => saved[saved.length - 1] };
};

const renderBoard = async () => {
  render(<KanbanBoard onLogout={() => {}} />);
  await screen.findAllByTestId(/column-/i);
};

describe("KanbanBoard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the board from the API", async () => {
    const { fetchMock } = mockApi();
    await renderBoard();
    expect(fetchMock).toHaveBeenCalledWith("/api/board");
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
    expect(screen.getByText("Align roadmap themes")).toBeInTheDocument();
  });

  it("shows a loading state, then an error if the board cannot load", async () => {
    mockApi({ loadOk: false });
    render(<KanbanBoard onLogout={() => {}} />);
    expect(screen.getByText(/loading board/i)).toBeInTheDocument();
    expect(await screen.findByText(/could not load the board/i)).toBeInTheDocument();
  });

  it("renames a column and saves it", async () => {
    const api = mockApi();
    await renderBoard();
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
    await waitFor(() => expect(api.lastSaved().columns[0].title).toBe("New Name"));
  });

  it("adds and removes a card, saving each change", async () => {
    const api = mockApi();
    await renderBoard();
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "New card");
    await userEvent.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();
    await waitFor(() => expect(api.saved).toHaveLength(1));
    const added = api.lastSaved();
    const newId = added.columns[0].cardIds[2];
    expect(added.cards[newId]).toEqual({ id: newId, title: "New card", details: "Notes" });

    await userEvent.click(within(column).getByRole("button", { name: /delete new card/i }));
    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
    await waitFor(() => expect(api.saved).toHaveLength(2));
    expect(api.lastSaved().cards[newId]).toBeUndefined();
    expect(api.lastSaved().columns[0].cardIds).toEqual(["card-1", "card-2"]);
  });

  it("does not add a card without a title", async () => {
    const api = mockApi();
    await renderBoard();
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));
    expect(within(column).getAllByTestId(/^card-/)).toHaveLength(2);
    expect(api.saved).toHaveLength(0);
  });

  it("edits a card and saves it", async () => {
    const api = mockApi();
    await renderBoard();
    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: /edit align roadmap themes/i }));

    const title = within(card).getByLabelText("Edit title");
    await userEvent.clear(title);
    await userEvent.type(title, "Updated title");
    const details = within(card).getByLabelText("Edit details");
    await userEvent.clear(details);
    await userEvent.type(details, "Updated details");
    await userEvent.click(within(card).getByRole("button", { name: /save/i }));

    expect(within(card).getByText("Updated title")).toBeInTheDocument();
    expect(within(card).getByText("Updated details")).toBeInTheDocument();
    await waitFor(() =>
      expect(api.lastSaved().cards["card-1"]).toEqual({
        id: "card-1",
        title: "Updated title",
        details: "Updated details",
      })
    );
  });

  it("cancels editing without changes or saves", async () => {
    const api = mockApi();
    await renderBoard();
    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: /edit align roadmap themes/i }));
    const title = within(card).getByLabelText("Edit title");
    await userEvent.clear(title);
    await userEvent.type(title, "Discarded");
    await userEvent.click(within(card).getByRole("button", { name: /cancel/i }));

    expect(within(card).getByText("Align roadmap themes")).toBeInTheDocument();
    expect(within(card).queryByText("Discarded")).not.toBeInTheDocument();
    expect(api.saved).toHaveLength(0);
  });

  it("shows the card count per column", async () => {
    mockApi();
    await renderBoard();
    expect(within(getFirstColumn()).getByText("2 cards")).toBeInTheDocument();
  });

  it("shows an error when saving fails", async () => {
    mockApi({ saveOk: false });
    await renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Delete Align roadmap themes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not save your changes/i);
  });

  it("shows AI board changes without saving them again", async () => {
    const chatBoard = structuredClone(initialData);
    chatBoard.cards["card-ai"] = { id: "card-ai", title: "From the AI", details: "" };
    chatBoard.columns[3].cardIds.push("card-ai");
    const api = mockApi({ chatBoard });
    await renderBoard();

    await userEvent.click(screen.getByRole("button", { name: /ask ai/i }));
    await userEvent.type(screen.getByLabelText("Message"), "Add a card to Review");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    const review = screen.getByTestId("column-col-review");
    expect(await within(review).findByText("From the AI")).toBeInTheDocument();
    expect(api.saved).toHaveLength(0);
  });

  it("sends saves in order", async () => {
    const api = mockApi();
    await renderBoard();
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "Abc");
    await waitFor(() => expect(api.lastSaved().columns[0].title).toBe("Abc"));
    expect(api.saved.map((board) => board.columns[0].title)).toEqual(["", "A", "Ab", "Abc"]);
  });
});
