import { search } from "@inquirer/prompts";

export interface SearchableOption<T = string> {
  name: string;
  value: T;
  description?: string;
}

export async function searchableSelect<T = string>(
  message: string,
  options: SearchableOption<T>[],
  _defaultValue?: T
): Promise<T> {
  return await search({
    message,
    source: async (input) => {
      if (!input) {
        return options;
      }
      
      const searchTerm = input.toLowerCase();
      return options.filter(opt => 
        opt.name.toLowerCase().includes(searchTerm) ||
        opt.description?.toLowerCase().includes(searchTerm)
      );
    }
  });
}
