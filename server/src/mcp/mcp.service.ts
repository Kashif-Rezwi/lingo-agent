import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

/**
 * Connects to the Lingo.dev MCP server and exposes its tools.
 * Established once at startup. Callers should check `isConnected`.
 * Used for querying exact, framework-specific configuration steps.
 */
@Injectable()
export class McpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpService.name);
  private client: Client | null = null;
  private connected = false;
  private readonly serverUrl: string;

  constructor(config: ConfigService) {
    this.serverUrl = config.getOrThrow<string>('LINGO_MCP_SERVER_URL');
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      this.client = new Client({ name: 'lingo-agent', version: '1.0.0' });
      const transport = new SSEClientTransport(new URL(this.serverUrl));
      await this.client.connect(transport);
      this.connected = true;
      this.logger.log(`Connected to Lingo.dev MCP server at ${this.serverUrl}`);
    } catch (err) {
      // Non-fatal at startup: the agent will get a clear error when it tries to use this
      this.connected = false;
      this.logger.warn(`MCP server unavailable: ${String(err)}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.close();
      this.logger.log('MCP connection closed');
    } catch {
      // Ignore disconnect errors on shutdown
    } finally {
      this.connected = false;
      this.client = null;
    }
  }

  /** Queries the MCP server for exact setup instructions for the framework and locales. */
  async getSetupInstructions(framework: string, locales: string[]): Promise<string> {
    if (!this.client || !this.connected) {
      throw new Error('MCP server is not connected. Check LINGO_MCP_SERVER_URL.');
    }

    const result = await this.client.callTool({
      name: 'get_setup_instructions',
      arguments: { framework, locales },
    });

    // MCP tool responses return content as an array of typed blocks
    const textBlock = (result.content as Array<{ type: string; text: string }>).find(
      (block) => block.type === 'text',
    );

    if (!textBlock) {
      throw new Error('MCP server returned no text content for setup instructions');
    }

    return textBlock.text;
  }

  /** Lists all available tools on the connected MCP server (useful for debugging). */
  async listTools(): Promise<string[]> {
    if (!this.client || !this.connected) return [];
    const { tools } = await this.client.listTools();
    return tools.map((t) => t.name);
  }
}
