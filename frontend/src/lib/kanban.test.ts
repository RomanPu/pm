import { moveCard, type Column } from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });

  it("moves a card to the end of its own column when dropped on the column", () => {
    const result = moveCard(baseColumns, "card-1", "col-a");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves a card into an empty column", () => {
    const columns: Column[] = [...baseColumns, { id: "col-c", title: "C", cardIds: [] }];
    const result = moveCard(columns, "card-3", "col-c");
    expect(result[1].cardIds).toEqual([]);
    expect(result[2].cardIds).toEqual(["card-3"]);
  });

  it("returns columns unchanged for unknown ids", () => {
    expect(moveCard(baseColumns, "missing", "card-1")).toBe(baseColumns);
    expect(moveCard(baseColumns, "card-1", "missing")).toBe(baseColumns);
  });

  it("returns columns unchanged when dropped on itself", () => {
    expect(moveCard(baseColumns, "card-1", "card-1")).toBe(baseColumns);
  });

  it("does not mutate the input", () => {
    const snapshot = JSON.parse(JSON.stringify(baseColumns));
    moveCard(baseColumns, "card-1", "col-b");
    expect(baseColumns).toEqual(snapshot);
  });
});
