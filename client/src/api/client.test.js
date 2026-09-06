import apiClient, { getMentors } from "./client";

describe("getMentors", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the legacy mentors URL when no topics are selected", async () => {
    const get = jest.spyOn(apiClient, "get").mockResolvedValue({ data: [] });

    await getMentors([]);

    expect(get).toHaveBeenCalledWith("/mentors");
  });

  it("appends selected topics as repeated encoded query parameters", async () => {
    const get = jest.spyOn(apiClient, "get").mockResolvedValue({ data: [] });

    await getMentors(["CV / Resume Review", "System Design Interviews"]);

    expect(get).toHaveBeenCalledWith(
      "/mentors?adviceTopics=CV+%2F+Resume+Review&adviceTopics=System+Design+Interviews"
    );
  });
});
